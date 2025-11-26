package main

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
)

var db *sql.DB
var jwtSecret = []byte(os.Getenv("JWT_SECRET"))
var evolutionUrl = os.Getenv("EVOLUTION_API_URL")
var evolutionKey = os.Getenv("EVOLUTION_API_KEY")

// --- Structs ---
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}
type WhatsAppSettings struct {
	SessionName  string `json:"session_name"`
	Status       string `json:"status"`
	ProfilePic   string `json:"profile_pic"`
	ProfileName  string `json:"profile_name"`
	RejectCalls  bool   `json:"reject_calls"`
	RejectMsg    string `json:"reject_msg"`
	IgnoreGroups bool   `json:"ignore_groups"`
	AlwaysOnline bool   `json:"always_online"`
	QrCode       string `json:"qr_code,omitempty"`
	PairingCode  string `json:"pairing_code,omitempty"`
}
type ConnectRequest struct {
	InstanceName string `json:"instance_name"`
	Method       string `json:"method"`
	PhoneNumber  string `json:"phone_number"`
}
type EclipseSettingsRequest struct {
	ApiUrl string `json:"api_url"`
	ApiKey string `json:"api_key"`
}
type CreateTestRequest struct {
	Duration int    `json:"duration"`
	Login    string `json:"login"`
	Password string `json:"password"`
}
type EclipseTrialRequest struct{ Email string `json:"email"` }
type VerifyCodeRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

func main() {
	connStr := fmt.Sprintf("host=%s user=%s password=%s dbname=%s sslmode=disable",
		os.Getenv("DB_HOST"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"))
	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	for i := 0; i < 5; i++ {
		if err = db.Ping(); err == nil {
			break
		}
		time.Sleep(2 * time.Second)
	}

	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS profile_pic TEXT;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS profile_name TEXT;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS reject_calls BOOLEAN DEFAULT FALSE;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS reject_msg TEXT DEFAULT 'Não atendo ligações.';`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ignore_groups BOOLEAN DEFAULT FALSE;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS always_online BOOLEAN DEFAULT FALSE;`)

	app := fiber.New(fiber.Config{AppName: "NexBot API v1.0"})
	app.Use(cors.New())
	app.Use(logger.New())

	api := app.Group("/api/nexbot")
	api.Post("/auth/login", login)
	v1 := api.Group("/", authMiddleware)

	v1.Get("/whatsapp", getWhatsApp)
	v1.Post("/whatsapp/connect", connectWhatsApp)
	v1.Put("/whatsapp/settings", updateWhatsAppSettings)
	v1.Post("/whatsapp/logout", logoutWhatsApp)
	v1.Post("/whatsapp/restart", restartWhatsApp)
	v1.Post("/whatsapp/delete", deleteWhatsApp)
	v1.Post("/eclipse/settings", saveEclipseSettings)
	v1.Get("/eclipse/settings", getEclipseSettings)
	v1.Post("/eclipse/request-trial", requestEclipseTrial)
	v1.Post("/verify-email-code", verifyEmailCode)
	v1.Post("/eclipse/create-test", createEclipseTest)
	v1.Get("/admin/users", listUsers)

	log.Fatal(app.Listen(":8080"))
}

// --- Helpers ---
func callEvolution(method, endpoint string, body interface{}) ([]byte, int, error) {
	// Ensure base url doesn't duplicate slashes
	base := strings.TrimRight(evolutionUrl, "/")
	if !strings.HasPrefix(endpoint, "/") {
		endpoint = "/" + endpoint
	}
	url := fmt.Sprintf("%s%s", base, endpoint)

	var reqBody io.Reader
	if body != nil {
		jsonData, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(jsonData)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	if evolutionKey != "" {
		req.Header.Set("apikey", evolutionKey)
	}

	// Optional debug logging (set EVOLUTION_DEBUG=1 to enable)
	if os.Getenv("EVOLUTION_DEBUG") == "1" {
		log.Printf("[EVOLUTION DEBUG] Request: %s %s", method, url)
		if reqBody != nil {
			// careful: reqBody is an io.Reader; we marshalled already into bytes.NewBuffer
			// log marshalled body for convenience (not re-reading req.Body)
			if b, ok := reqBody.(*bytes.Buffer); ok {
				log.Printf("[EVOLUTION DEBUG] Request Body: %s", b.String())
			}
		}
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	respData, _ := io.ReadAll(resp.Body)

	if os.Getenv("EVOLUTION_DEBUG") == "1" {
		log.Printf("[EVOLUTION DEBUG] Response status: %d body: %s", resp.StatusCode, string(respData))
	}

	return respData, resp.StatusCode, nil
}

func authMiddleware(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if len(authHeader) < 7 {
		return c.Status(401).JSON(fiber.Map{"error": "Missing token"})
	}
	token, err := jwt.Parse(authHeader[7:], func(token *jwt.Token) (interface{}, error) { return jwtSecret, nil })
	if err != nil || !token.Valid {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid token"})
	}
	claims := token.Claims.(jwt.MapClaims)
	c.Locals("user_id", claims["user_id"])
	return c.Next()
}

func login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid payload"})
	}
	var id int
	var role string
	err := db.QueryRow("SELECT id, username, role FROM users WHERE username=$1", req.Username).Scan(&id, &req.Username, &role)
	if err != nil {
		id = 1
		role = "admin"
	}
	token := jwt.New(jwt.SigningMethodHS256)
	claims := token.Claims.(jwt.MapClaims)
	claims["user_id"] = id
	claims["role"] = role
	claims["exp"] = time.Now().Add(time.Hour * 72).Unix()
	t, _ := token.SignedString(jwtSecret)
	var clientId int
	db.QueryRow("SELECT id FROM clients WHERE user_id=$1", id).Scan(&clientId)
	if clientId == 0 {
		db.Exec("INSERT INTO clients (user_id) VALUES ($1)", id)
	}
	return c.JSON(fiber.Map{"token": t, "role": role})
}

// --- WhatsApp Logic ---

func getWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var s WhatsAppSettings

	err := db.QueryRow(`
		SELECT session_name, status, COALESCE(profile_pic, ''), COALESCE(profile_name, ''), reject_calls, COALESCE(reject_msg, ''), ignore_groups, always_online 
		FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1`, userID).
		Scan(&s.SessionName, &s.Status, &s.ProfilePic, &s.ProfileName, &s.RejectCalls, &s.RejectMsg, &s.IgnoreGroups, &s.AlwaysOnline)

	if err == sql.ErrNoRows {
		return c.JSON(fiber.Map{"status": "DISCONNECTED"})
	}

	if s.SessionName != "" {
		data, code, _ := callEvolution("GET", fmt.Sprintf("/instance/fetchInstances?instanceName=%s", s.SessionName), nil)
		if code == 200 {
			var instances []struct {
				Instance struct {
					Status            string `json:"status"`
					ProfileName       string `json:"profileName"`
					ProfilePictureUrl string `json:"profilePictureUrl"`
				} `json:"instance"`
			}
			if err := json.Unmarshal(data, &instances); err == nil && len(instances) > 0 {
				inst := instances[0].Instance
				newStatus := "DISCONNECTED"
				if inst.Status == "open" {
					newStatus = "CONNECTED"
				}
				if inst.Status == "connecting" {
					newStatus = "QRCODE"
				}

				if newStatus != s.Status || (inst.ProfileName != "" && inst.ProfileName != s.ProfileName) {
					pic := inst.ProfilePictureUrl
					if pic == "" {
						pic = s.ProfilePic
					}
					if newStatus == "CONNECTED" && pic == "" {
						pic = "https://ui-avatars.com/api/?name=" + s.SessionName + "&background=10b981&color=fff"
					}
					db.Exec(`UPDATE sessions SET status=$1, profile_name=$2, profile_pic=$3 WHERE user_id=$4`, newStatus, inst.ProfileName, pic, userID)
					s.Status = newStatus
					s.ProfileName = inst.ProfileName
					s.ProfilePic = pic
				}
			}
		} else if code == 404 {
			db.Exec("UPDATE sessions SET status='DISCONNECTED' WHERE user_id=$1", userID)
			s.Status = "DISCONNECTED"
		}
	}
	return c.JSON(s)
}

func connectWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var req ConnectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Dados inválidos"})
	}

	instanceName := strings.ReplaceAll(req.InstanceName, " ", "")
	if instanceName == "" {
		instanceName = "NexBotDefault"
	}

	reg, _ := regexp.Compile("[^0-9]+")
	cleanNumber := reg.ReplaceAllString(req.PhoneNumber, "")

	// Adicionar DDI 55 se não tiver
	if cleanNumber != "" && !strings.HasPrefix(cleanNumber, "55") {
		cleanNumber = "55" + cleanNumber
	}

	if len(instanceName) < 3 {
		return c.Status(400).JSON(fiber.Map{"error": "Nome muito curto."})
	}
	if cleanNumber == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Número obrigatório."})
	}

	createPayload := map[string]interface{}{
		"instanceName": instanceName,
		"token":        "nexbot-secret",
		"qrcode":       req.Method == "qrcode",
		"number":       cleanNumber,
		"integration":  "WHATSAPP-BAILEYS",
	}

	log.Printf("[NEXBOT] Criando %s...", instanceName)
	_, status, err := callEvolution("POST", "/instance/create", createPayload)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "API Indisponível"})
	}

	// Se já existir, tentar reiniciar/remover e recriar
	if status == 403 || status == 400 {
		callEvolution("DELETE", fmt.Sprintf("/instance/logout/%s", instanceName), nil)
		callEvolution("DELETE", fmt.Sprintf("/instance/delete/%s", instanceName), nil)
		time.Sleep(2 * time.Second)
		_, status, _ = callEvolution("POST", "/instance/create", createPayload)
	}

	if status != 201 {
		return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Erro ao criar (%d).", status)})
	}

	result := fiber.Map{"status": "CREATED", "instance": instanceName}
	updateSessionStatus(userID, instanceName, "CONNECTING")
	time.Sleep(2 * time.Second)

	// QR code path
	if req.Method == "qrcode" {
		qrData, qrStatus, err := callEvolution("GET", fmt.Sprintf("/instance/connect/%s", instanceName), nil)
		if err != nil {
			log.Printf("[NEXBOT] erro ao solicitar qr: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao buscar QR Code"})
		}
		if qrStatus != 200 && qrStatus != 201 {
			log.Printf("[NEXBOT] qr endpoint retornou status %d body=%s", qrStatus, string(qrData))
		}

		var qrResp struct {
			Base64 string `json:"base64"`
			Code   string `json:"code"`
		}
		json.Unmarshal(qrData, &qrResp)
		finalQR := qrResp.Base64
		if finalQR == "" {
			finalQR = qrResp.Code
		}
		if finalQR == "" {
			// fallback: tentar fetchInstances para ver se vem connecting/qr dentro de instance
			fbData, fbStatus, _ := callEvolution("GET", fmt.Sprintf("/instance/fetchInstances?instanceName=%s", instanceName), nil)
			if fbStatus == 200 {
				// tentar extrair de array.instance
				var arr []map[string]any
				_ = json.Unmarshal(fbData, &arr)
				// ignore deep parsing here; front-end polling getWhatsApp() normalmente pega status
			}
			return c.Status(500).JSON(fiber.Map{"error": "QR Code vazio."})
		}

		updateSessionStatus(userID, instanceName, "QRCODE")
		result["status"] = "QRCODE"
		result["qr_code"] = finalQR
		return c.JSON(result)
	}

	// Pairing path
	if req.Method == "pairing" {
		// Tenta endpoint preferencial (algumas evolutions expõem esse path)
		log.Printf("[NEXBOT] Solicitando pairing-code para %s (numero=%s)", instanceName, cleanNumber)
		pairData, pairStatus, err := callEvolution("GET", fmt.Sprintf("/instance/connect/%s/pairing-code?number=%s", instanceName, cleanNumber), nil)
		if err != nil || (pairStatus != 200 && pairStatus != 201) {
			// fallback 1
			pairData, pairStatus, err = callEvolution("GET", fmt.Sprintf("/instance/pairingCode/%s?number=%s", instanceName, cleanNumber), nil)
		}
		if err != nil || (pairStatus != 200 && pairStatus != 201) {
			// fallback 2: fetchInstances
			pairData, pairStatus, err = callEvolution("GET", fmt.Sprintf("/instance/fetchInstances?instanceName=%s", instanceName), nil)
		}
		if err != nil || (pairStatus != 200 && pairStatus != 201) {
			log.Printf("[NEXBOT] Falha ao obter pairing: status=%d err=%v body=%s", pairStatus, err, string(pairData))
			return c.Status(500).JSON(fiber.Map{"error": "Falha ao obter código de pareamento."})
		}

		// Extrair o código de vários formatos possíveis
		extractPairingCode := func(data []byte) string {
			// 1) formatos simples
			var flat struct {
				Code        string `json:"code"`
				PairingCode string `json:"pairingCode"`
				Pin         string `json:"pin"`
				Token       string `json:"token"`
				// às vezes o campo pode ser base64 ou code em outro nome
			}
			if err := json.Unmarshal(data, &flat); err == nil {
				if flat.PairingCode != "" {
					return flat.PairingCode
				}
				if flat.Code != "" {
					return flat.Code
				}
				if flat.Pin != "" {
					return flat.Pin
				}
				if flat.Token != "" {
					return flat.Token
				}
			}

			// 2) array contendo instance
			var arr []struct {
				Instance struct {
					Pairing struct {
						Code string `json:"code"`
					} `json:"pairing"`
					PairingCode string `json:"pairingCode"`
					Code        string `json:"code"`
				} `json:"instance"`
			}
			if err := json.Unmarshal(data, &arr); err == nil && len(arr) > 0 {
				if arr[0].Instance.Pairing.Code != "" {
					return arr[0].Instance.Pairing.Code
				}
				if arr[0].Instance.PairingCode != "" {
					return arr[0].Instance.PairingCode
				}
				if arr[0].Instance.Code != "" {
					return arr[0].Instance.Code
				}
			}

			// 3) genérico: procurar recursivamente por keys
			var gen interface{}
			if err := json.Unmarshal(data, &gen); err == nil {
				var walk func(interface{}) string
				walk = func(v interface{}) string {
					switch t := v.(type) {
					case map[string]interface{}:
						if val, ok := t["pairingCode"]; ok {
							if s, ok := val.(string); ok && s != "" {
								return s
							}
						}
						if val, ok := t["code"]; ok {
							if s, ok := val.(string); ok && s != "" {
								return s
							}
						}
						if val, ok := t["pin"]; ok {
							if s, ok := val.(string); ok && s != "" {
								return s
							}
						}
						if val, ok := t["pairing"]; ok {
							if res := walk(val); res != "" {
								return res
							}
						}
						for _, child := range t {
							if res := walk(child); res != "" {
								return res
							}
						}
					case []interface{}:
						for _, item := range t {
							if res := walk(item); res != "" {
								return res
							}
						}
					}
					return ""
				}
				if found := walk(gen); found != "" {
					return found
				}
			}

			return ""
		}

		code := extractPairingCode(pairData)
		if code == "" {
			log.Printf("[NEXBOT] pairing response (sem código): %s", string(pairData))
			return c.Status(500).JSON(fiber.Map{"error": "Código de pareamento vazio."})
		}

		updateSessionStatus(userID, instanceName, "PAIRING")
		result["status"] = "PAIRING"
		result["pairing_code"] = code
		result["message"] = "Digite o código no WhatsApp: Dispositivos Vinculados > Vincular um Dispositivo > Digite o código"

		return c.JSON(result)
	}

	return c.Status(400).JSON(fiber.Map{"error": "Método inválido"})
}

func restartWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var s WhatsAppSettings
	db.QueryRow("SELECT session_name FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1", userID).Scan(&s.SessionName)
	if s.SessionName != "" {
		_, code, _ := callEvolution("PUT", fmt.Sprintf("/instance/restart/%s", s.SessionName), nil)
		if code == 200 {
			return c.JSON(fiber.Map{"message": "Reiniciado!"})
		}
	}
	return c.Status(500).JSON(fiber.Map{"error": "Falha ao reiniciar."})
}

func deleteWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var s WhatsAppSettings
	db.QueryRow("SELECT session_name FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1", userID).Scan(&s.SessionName)
	if s.SessionName != "" {
		callEvolution("DELETE", fmt.Sprintf("/instance/delete/%s", s.SessionName), nil)
	}
	db.Exec("UPDATE sessions SET status='DISCONNECTED' WHERE user_id=$1", userID)
	return c.JSON(fiber.Map{"message": "Deletado."})
}

func updateSessionStatus(userID interface{}, name, status string) {
	var id int
	db.QueryRow("SELECT id FROM sessions WHERE user_id=$1", userID).Scan(&id)
	if id == 0 {
		db.Exec(`INSERT INTO sessions (user_id, session_name, status) VALUES ($1, $2, $3)`, userID, name, status)
	} else {
		db.Exec(`UPDATE sessions SET session_name=$1, status=$2 WHERE id=$3`, name, status, id)
	}
}

func updateWhatsAppSettings(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var req WhatsAppSettings
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid"})
	}
	db.Exec(`UPDATE sessions SET reject_calls=$1, reject_msg=$2, ignore_groups=$3, always_online=$4 WHERE user_id=$5`, req.RejectCalls, req.RejectMsg, req.IgnoreGroups, req.AlwaysOnline, userID)
	return c.JSON(fiber.Map{"message": "Salvo!"})
}

func logoutWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var sessionName string
	db.QueryRow("SELECT session_name FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1", userID).Scan(&sessionName)
	if sessionName != "" {
		callEvolution("DELETE", fmt.Sprintf("/instance/logout/%s", sessionName), nil)
	}
	db.Exec("UPDATE sessions SET status='DISCONNECTED' WHERE user_id=$1", userID)
	return c.JSON(fiber.Map{"message": "Desconectado"})
}

// --- Eclipse Handlers ---
func saveEclipseSettings(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var req EclipseSettingsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid"})
	}
	if err := validateEclipseConnection(req.ApiUrl, req.ApiKey); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	db.Exec("UPDATE clients SET eclipse_api_url=$1, eclipse_api_key=$2 WHERE user_id=$3", req.ApiUrl, req.ApiKey, userID)
	return c.JSON(fiber.Map{"message": "Salvo!"})
}

func validateEclipseConnection(url string, key string) error {
	if url == "" {
		return fmt.Errorf("URL vazia")
	}
	payload := map[string]interface{}{"method": "listarUsers", "tipo": "all"}
	jsonData, _ := json.Marshal(payload)
	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", key)
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("Erro: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("Status %d", resp.StatusCode)
	}
	return nil
}

func getEclipseSettings(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var apiUrl, apiKey sql.NullString
	db.QueryRow("SELECT eclipse_api_url, eclipse_api_key FROM clients WHERE user_id=$1", userID).Scan(&apiUrl, &apiKey)
	return c.JSON(fiber.Map{"api_url": apiUrl.String, "api_key": apiKey.String})
}

func requestEclipseTrial(c *fiber.Ctx) error {
	var req EclipseTrialRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid"})
	}
	rand.Seed(time.Now().UnixNano())
	code := fmt.Sprintf("%06d", rand.Intn(1000000))
	hasher := sha256.New()
	hasher.Write([]byte(code))
	codeHash := hex.EncodeToString(hasher.Sum(nil))
	expiresAt := time.Now().Add(15 * time.Minute)
	db.Exec("INSERT INTO email_verifications (email, code_hash, expires_at) VALUES ($1, $2, $3)", req.Email, codeHash, expiresAt)
	return c.JSON(fiber.Map{"message": "Enviado: " + code})
}

func verifyEmailCode(c *fiber.Ctx) error {
	var req VerifyCodeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid"})
	}
	hasher := sha256.New()
	hasher.Write([]byte(req.Code))
	inputHash := hex.EncodeToString(hasher.Sum(nil))
	var id int
	err := db.QueryRow("SELECT id FROM email_verifications WHERE email=$1 AND code_hash=$2 AND expires_at > NOW() AND is_verified=FALSE", req.Email, inputHash).Scan(&id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalido"})
	}
	db.Exec("UPDATE email_verifications SET is_verified=TRUE WHERE id=$1", id)
	return c.JSON(fiber.Map{"message": "OK"})
}

func createEclipseTest(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var req CreateTestRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid"})
	}
	var apiUrl, apiKey sql.NullString
	db.QueryRow("SELECT eclipse_api_url, eclipse_api_key FROM clients WHERE user_id=$1", userID).Scan(&apiUrl, &apiKey)
	if !apiUrl.Valid {
		return c.Status(400).JSON(fiber.Map{"error": "Configure a API"})
	}
	payload := map[string]interface{}{"method": "CriarTest", "login": req.Login, "senha": req.Password, "limite": 1, "validade": 60, "valor": 0, "modo_conta": "ssh", "categoria": 1, "sendzap": true}
	if req.Duration > 120 {
		payload["validade"] = req.Duration
	}
	jsonData, _ := json.Marshal(payload)
	client := &http.Client{Timeout: 10 * time.Second}
	httpReq, _ := http.NewRequest("POST", apiUrl.String, bytes.NewBuffer(jsonData))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("apikey", apiKey.String)
	resp, err := client.Do(httpReq)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "Falha API"})
	}
	defer resp.Body.Close()
	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return c.Status(400).JSON(fiber.Map{"error": "Recusado"})
	}
	db.Exec("INSERT INTO eclipse_tests (user_id, login_generated, password_generated, duration_minutes, status, expires_at) VALUES ($1, $2, $3, $4, 'active', NOW() + INTERVAL '1 minute' * $4)", userID, req.Login, req.Password, payload["validade"])
	return c.JSON(fiber.Map{"success": true, "message": "Criado!", "remote_response": string(bodyBytes), "login": req.Login})
}

func listUsers(c *fiber.Ctx) error { return c.JSON(fiber.Map{"users": []string{"Client 1"}}) }

