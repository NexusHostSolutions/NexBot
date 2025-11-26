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

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type WhatsAppSession struct {
	SessionName   string `json:"session_name"`
        Number        string `json:"number"`
	Status        string `json:"status"`
	ProfilePic    string `json:"profile_pic"`
	ProfileName   string `json:"profile_name"`
	ProfileStatus string `json:"profile_status"`
	QrCode        string `json:"qr_code,omitempty"`
	PairingCode   string `json:"pairing_code,omitempty"`
	RejectCall    bool   `json:"reject_call"`
	MsgCall       string `json:"msg_call"`
	GroupsIgnore  bool   `json:"groups_ignore"`
	AlwaysOnline  bool   `json:"always_online"`
	ReadMessages  bool   `json:"read_messages"`
	ReadStatus    bool   `json:"read_status"`
}

type WhatsAppSettingsRequest struct {
	RejectCall   bool   `json:"reject_call"`
	MsgCall      string `json:"msg_call"`
	GroupsIgnore bool   `json:"groups_ignore"`
	AlwaysOnline bool   `json:"always_online"`
	ReadMessages bool   `json:"read_messages"`
	ReadStatus   bool   `json:"read_status"`
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

	// Migrations
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS profile_pic TEXT;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS profile_name TEXT;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS profile_status TEXT;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS reject_call BOOLEAN DEFAULT FALSE;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS msg_call TEXT DEFAULT '';`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS groups_ignore BOOLEAN DEFAULT FALSE;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS always_online BOOLEAN DEFAULT FALSE;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS read_messages BOOLEAN DEFAULT FALSE;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS read_status BOOLEAN DEFAULT FALSE;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS qr_code TEXT;`)

	app := fiber.New(fiber.Config{AppName: "NexBot API v1.0"})
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))
	app.Use(logger.New())

	api := app.Group("/api/nexbot")
	api.Post("/auth/login", login)
	v1 := api.Group("/", authMiddleware)

	v1.Get("/whatsapp", getWhatsApp)
	v1.Post("/whatsapp/connect", connectWhatsApp)
	v1.Post("/whatsapp/reconnect", reconnectWhatsApp)
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

	log.Println("🚀 NexBot API iniciando na porta 8080...")
	log.Fatal(app.Listen(":8080"))
}

func callEvolution(method, endpoint string, body interface{}) ([]byte, int, error) {
	base := strings.TrimRight(evolutionUrl, "/")
	if !strings.HasPrefix(endpoint, "/") {
		endpoint = "/" + endpoint
	}
	url := fmt.Sprintf("%s%s", base, endpoint)

	var reqBody io.Reader
	var jsonData []byte
	if body != nil {
		jsonData, _ = json.Marshal(body)
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

	log.Printf("[EVOLUTION] %s %s", method, url)

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[EVOLUTION] Erro: %v", err)
		return nil, 0, err
	}
	defer resp.Body.Close()
	respData, _ := io.ReadAll(resp.Body)

	log.Printf("[EVOLUTION] Status: %d | Body: %s", resp.StatusCode, truncateLog(string(respData), 800))

	return respData, resp.StatusCode, nil
}

func truncateLog(s string, maxLen int) string {
	if len(s) > maxLen {
		return s[:maxLen] + "..."
	}
	return s
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

// ============================================
// GET /whatsapp - Retorna estado atual (CORRIGIDO)
// ============================================
func getWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var s WhatsAppSession

	// Buscar sessão no banco
	err := db.QueryRow(`
		SELECT session_name, status, 
		       COALESCE(profile_pic, ''), COALESCE(profile_name, ''), COALESCE(profile_status, ''),
		       COALESCE(reject_call, false), COALESCE(msg_call, ''), COALESCE(groups_ignore, false),
		       COALESCE(always_online, false), COALESCE(read_messages, false), COALESCE(read_status, false),
		       COALESCE(qr_code, '')
		FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1`, userID).
		Scan(&s.SessionName, &s.Status, &s.ProfilePic, &s.ProfileName, &s.ProfileStatus,
			&s.RejectCall, &s.MsgCall, &s.GroupsIgnore, &s.AlwaysOnline, &s.ReadMessages, &s.ReadStatus, &s.QrCode)

	if err == sql.ErrNoRows {
		return c.JSON(fiber.Map{"status": "DISCONNECTED"})
	}

	if s.SessionName != "" {
		log.Printf("[NEXBOT] Verificando instância '%s' na Evolution...", s.SessionName)
		data, code, _ := callEvolution("GET", fmt.Sprintf("/instance/fetchInstances?instanceName=%s", s.SessionName), nil)
		
		if code == 200 {
			// Estrutura flexível para pegar dados da raiz OU do objeto instance
			var instances []struct {
				ConnectionStatus  string `json:"connectionStatus"`
				Status            string `json:"status"`
				State             string `json:"state"`
				ProfileName       string `json:"profileName"`
				ProfilePictureUrl string `json:"profilePicUrl"`
				ProfileStatus     string `json:"profileStatus"`
                                Number            string `json:"number"`
				Instance          *struct {
					Status string `json:"status"`
					State  string `json:"state"`
				} `json:"instance"`
			}

			if json.Unmarshal(data, &instances) == nil && len(instances) > 0 {
				inst := instances[0]
				
				// Lógica de Prioridade: Raiz > Fallback
				statusRaw := strings.ToLower(inst.ConnectionStatus)
				if statusRaw == "" { statusRaw = strings.ToLower(inst.Status) }
				if statusRaw == "" { statusRaw = strings.ToLower(inst.State) }
				
				// Fallback se estiver aninhado
				if statusRaw == "" && inst.Instance != nil {
					statusRaw = strings.ToLower(inst.Instance.Status)
					if statusRaw == "" { statusRaw = strings.ToLower(inst.Instance.State) }
				}

				log.Printf("[NEXBOT] Status encontrado: '%s'", statusRaw)

				newStatus := "DISCONNECTED"

				if statusRaw == "open" || statusRaw == "connected" {
					newStatus = "CONNECTED"
				} else if statusRaw == "connecting" {
					newStatus = "QRCODE" // Ou mantemos CONNECTING se preferir
				}

				// Atualiza dados do perfil
pic := inst.ProfilePictureUrl
name := inst.ProfileName
pStatus := inst.ProfileStatus

// --- NOVO BLOCO ADICIONADO: buscar foto oficial via Evolution ---
if newStatus == "CONNECTED" {
    picData, picStatus, _ := callEvolution("GET", fmt.Sprintf("/chat/fetchProfilePictureUrl/%s", s.SessionName), nil)

    if picStatus == 200 {
        var resp map[string]interface{}
        if json.Unmarshal(picData, &resp) == nil {
            if url, ok := resp["url"].(string); ok && url != "" {
                pic = url
            }
        }
    }
}
// ----------------------------------------------------------------

// Fallbacks
if pic == "" { pic = s.ProfilePic }
if newStatus == "CONNECTED" && pic == "" {
    pic = "https://ui-avatars.com/api/?name=" + s.SessionName + "&background=10b981&color=fff&size=200"
}

if name == "" { name = s.ProfileName }
if name == "" { name = s.SessionName }

// Atualizar banco
db.Exec(`UPDATE sessions SET status=$1, profile_name=$2, profile_pic=$3, profile_status=$4, number=$5 WHERE user_id=$6`,
    newStatus, name, pic, pStatus, inst.Number, userID)

s.Status = newStatus
s.ProfileName = name
s.ProfilePic = pic
s.ProfileStatus = pStatus
s.Number = inst.Number


				if newStatus == "CONNECTED" {
					// Busca configurações
					settingsData, settingsCode, _ := callEvolution("GET", fmt.Sprintf("/settings/find/%s", s.SessionName), nil)
					if settingsCode == 200 {
						var sets struct {
							RejectCall   bool   `json:"rejectCall"`
							MsgCall      string `json:"msgCall"`
							GroupsIgnore bool   `json:"groupsIgnore"`
							AlwaysOnline bool   `json:"alwaysOnline"`
							ReadMessages bool   `json:"readMessages"`
							ReadStatus   bool   `json:"readStatus"`
						}
						
						if json.Unmarshal(settingsData, &sets) == nil {
							s.RejectCall = sets.RejectCall
							s.MsgCall = sets.MsgCall
							s.GroupsIgnore = sets.GroupsIgnore
							s.AlwaysOnline = sets.AlwaysOnline
							s.ReadMessages = sets.ReadMessages
							s.ReadStatus = sets.ReadStatus

							db.Exec(`UPDATE sessions SET reject_call=$1, msg_call=$2, groups_ignore=$3, always_online=$4, read_messages=$5, read_status=$6 WHERE user_id=$7`,
								s.RejectCall, s.MsgCall, s.GroupsIgnore, s.AlwaysOnline, s.ReadMessages, s.ReadStatus, userID)
						}
					}
				}
			}
		} else if code == 404 {
			db.Exec("UPDATE sessions SET status='DISCONNECTED' WHERE user_id=$1", userID)
			s.Status = "DISCONNECTED"
		}
	}

	return c.JSON(s)
}

// ============================================
// POST /whatsapp/connect - Criar nova instância
// ============================================
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
	if cleanNumber != "" && !strings.HasPrefix(cleanNumber, "55") {
		cleanNumber = "55" + cleanNumber
	}

	if len(instanceName) < 3 {
		return c.Status(400).JSON(fiber.Map{"error": "Nome muito curto (mínimo 3 caracteres)."})
	}
	if cleanNumber == "" || len(cleanNumber) < 12 {
		return c.Status(400).JSON(fiber.Map{"error": "Número inválido. Use formato: 5511999999999"})
	}

	log.Printf("[NEXBOT] Criando instância: %s para número %s", instanceName, cleanNumber)

	// Verificar se já existe na Evolution e deletar
	fetchData, fetchStatus, _ := callEvolution("GET", fmt.Sprintf("/instance/fetchInstances?instanceName=%s", instanceName), nil)
	if fetchStatus == 200 {
		var instances []interface{}
		if json.Unmarshal(fetchData, &instances) == nil && len(instances) > 0 {
			log.Printf("[NEXBOT] Instância já existe, removendo...")
			callEvolution("DELETE", fmt.Sprintf("/instance/logout/%s", instanceName), nil)
			time.Sleep(1 * time.Second)
			callEvolution("DELETE", fmt.Sprintf("/instance/delete/%s", instanceName), nil)
			time.Sleep(2 * time.Second)
		}
	}

	// Criar instância
	createPayload := map[string]interface{}{
		"instanceName": instanceName,
		"token":        "nexbot-" + instanceName,
		"qrcode":       true,
		"number":       cleanNumber,
		"integration":  "WHATSAPP-BAILEYS",
		"rejectCall":   false,
		"msgCall":      "Desculpe, não aceitamos chamadas de voz ou vídeo.",
		"groupsIgnore": false,
		"alwaysOnline": false,
		"readMessages": false,
		"readStatus":   false,
	}

	createResp, status, err := callEvolution("POST", "/instance/create", createPayload)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "Evolution API indisponível"})
	}

	if status != 201 && status != 200 {
		log.Printf("[NEXBOT] Erro ao criar: %d - %s", status, string(createResp))
		return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Erro ao criar instância (status %d)", status)})
	}

	// Salvar no banco
	var sessionId int
	db.QueryRow("SELECT id FROM sessions WHERE user_id=$1", userID).Scan(&sessionId)
	if sessionId == 0 {
		db.Exec(`INSERT INTO sessions (user_id, session_name, status) VALUES ($1, $2, 'CONNECTING')`, userID, instanceName)
	} else {
		db.Exec(`UPDATE sessions SET session_name=$1, status='CONNECTING' WHERE id=$2`, instanceName, sessionId)
	}

	time.Sleep(3 * time.Second)

	result := fiber.Map{"status": "CREATED", "instance": instanceName}

	// QR CODE
	if req.Method == "qrcode" {
		qrData, _, _ := callEvolution("GET", fmt.Sprintf("/instance/connect/%s", instanceName), nil)
		finalQR := extractQRCode(qrData)

		if finalQR == "" {
			time.Sleep(2 * time.Second)
			qrData, _, _ = callEvolution("GET", fmt.Sprintf("/instance/connect/%s", instanceName), nil)
			finalQR = extractQRCode(qrData)
		}

		if finalQR == "" {
			return c.Status(500).JSON(fiber.Map{"error": "QR Code não disponível."})
		}

		if !strings.HasPrefix(finalQR, "data:image") {
			finalQR = "data:image/png;base64," + finalQR
		}

		db.Exec("UPDATE sessions SET status='QRCODE', qr_code=$1 WHERE user_id=$2", finalQR, userID)

		result["status"] = "QRCODE"
		result["qr_code"] = finalQR
		return c.JSON(result)
	}

	// PAIRING CODE
	if req.Method == "pairing" {
		callEvolution("GET", fmt.Sprintf("/instance/connect/%s", instanceName), nil)
		time.Sleep(2 * time.Second)

		pairData, pairStatus, _ := callEvolution("GET", fmt.Sprintf("/instance/connect/%s?number=%s", instanceName, cleanNumber), nil)

		if pairStatus != 200 && pairStatus != 201 {
			pairData, _, _ = callEvolution("POST", fmt.Sprintf("/instance/connect/%s", instanceName), map[string]string{"number": cleanNumber})
		}

		code := extractPairingCode(pairData)

		if code == "" {
			return c.Status(500).JSON(fiber.Map{"error": "Código de pareamento não retornado."})
		}

		code = strings.ToUpper(strings.TrimSpace(code))
		if len(code) == 8 && !strings.Contains(code, "-") {
			code = code[:4] + "-" + code[4:]
		}

		db.Exec("UPDATE sessions SET status='PAIRING' WHERE user_id=$1", userID)

		result["status"] = "PAIRING"
		result["pairing_code"] = code
		return c.JSON(result)
	}

	return c.Status(400).JSON(fiber.Map{"error": "Método inválido"})
}

// ============================================
// POST /whatsapp/reconnect - Reconectar instância
// ============================================
func reconnectWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")

	var req struct {
		Method      string `json:"method"`
		PhoneNumber string `json:"phone_number"`
	}
	c.BodyParser(&req)

	var sessionName string
	db.QueryRow("SELECT session_name FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1", userID).Scan(&sessionName)

	if sessionName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Nenhuma instância encontrada"})
	}

	reg, _ := regexp.Compile("[^0-9]+")
	cleanNumber := reg.ReplaceAllString(req.PhoneNumber, "")
	if cleanNumber != "" && !strings.HasPrefix(cleanNumber, "55") {
		cleanNumber = "55" + cleanNumber
	}

	log.Printf("[NEXBOT] Reconectando instância %s", sessionName)

	result := fiber.Map{"status": "RECONNECTING", "instance": sessionName}

	if req.Method == "qrcode" || req.Method == "" {
		qrData, _, _ := callEvolution("GET", fmt.Sprintf("/instance/connect/%s", sessionName), nil)
		finalQR := extractQRCode(qrData)

		if finalQR == "" {
			time.Sleep(2 * time.Second)
			qrData, _, _ = callEvolution("GET", fmt.Sprintf("/instance/connect/%s", sessionName), nil)
			finalQR = extractQRCode(qrData)
		}

		if finalQR != "" {
			if !strings.HasPrefix(finalQR, "data:image") {
				finalQR = "data:image/png;base64," + finalQR
			}
			db.Exec("UPDATE sessions SET status='QRCODE', qr_code=$1 WHERE user_id=$2", finalQR, userID)
			result["status"] = "QRCODE"
			result["qr_code"] = finalQR
		}
	} else if req.Method == "pairing" && cleanNumber != "" {
		callEvolution("GET", fmt.Sprintf("/instance/connect/%s", sessionName), nil)
		time.Sleep(2 * time.Second)

		pairData, _, _ := callEvolution("GET", fmt.Sprintf("/instance/connect/%s?number=%s", sessionName, cleanNumber), nil)
		code := extractPairingCode(pairData)

		if code != "" {
			code = strings.ToUpper(strings.TrimSpace(code))
			if len(code) == 8 && !strings.Contains(code, "-") {
				code = code[:4] + "-" + code[4:]
			}
			db.Exec("UPDATE sessions SET status='PAIRING' WHERE user_id=$1", userID)
			result["status"] = "PAIRING"
			result["pairing_code"] = code
		}
	}

	return c.JSON(result)
}

func updateWhatsAppSettings(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var req WhatsAppSettingsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Dados inválidos"})
	}

	var sessionName string
	db.QueryRow("SELECT session_name FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1", userID).Scan(&sessionName)

	if sessionName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Nenhuma sessão encontrada"})
	}

	settingsPayload := map[string]interface{}{
		"rejectCall":      req.RejectCall,
		"msgCall":         req.MsgCall,
		"groupsIgnore":    req.GroupsIgnore,
		"alwaysOnline":    req.AlwaysOnline,
		"readMessages":    req.ReadMessages,
		"readStatus":      req.ReadStatus,
		"syncFullHistory": false,
	}

	_, status, _ := callEvolution("POST", fmt.Sprintf("/settings/set/%s", sessionName), settingsPayload)

	if status != 200 && status != 201 {
		return c.Status(500).JSON(fiber.Map{"error": "Falha ao atualizar configurações"})
	}

	db.Exec(`UPDATE sessions SET reject_call=$1, msg_call=$2, groups_ignore=$3, always_online=$4, read_messages=$5, read_status=$6 WHERE user_id=$7`,
		req.RejectCall, req.MsgCall, req.GroupsIgnore, req.AlwaysOnline, req.ReadMessages, req.ReadStatus, userID)

	return c.JSON(fiber.Map{"message": "Configurações salvas com sucesso!"})
}

func restartWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")

	var sessionName string
	db.QueryRow("SELECT session_name FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1", userID).
		Scan(&sessionName)

	if sessionName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Nenhuma instância encontrada."})
	}

	log.Printf("[NEXBOT] Reiniciando instância '%s'...", sessionName)

	// 1 — DESLOGAR
	callEvolution("DELETE", fmt.Sprintf("/instance/logout/%s", sessionName), nil)

	// 2 — AGUARDAR DESCONECTAR COMPLETAMENTE
	for i := 0; i < 10; i++ { // tenta por até 10 segundos
		time.Sleep(1 * time.Second)

		statusData, code, _ := callEvolution("GET",
			fmt.Sprintf("/instance/fetchInstances?instanceName=%s", sessionName), nil)

		if code != 200 {
			continue
		}

		var inst []map[string]interface{}
		if json.Unmarshal(statusData, &inst) == nil && len(inst) > 0 {
			state := strings.ToLower(fmt.Sprint(inst[0]["connectionStatus"]))

			log.Printf("[NEXBOT] Estado atual da instância após logout: %s", state)

			if state == "disconnected" || state == "close" {
				break
			}

			if i == 9 {
				return c.Status(500).JSON(fiber.Map{"error": "A Evolution não finalizou o logout."})
			}
		}
	}

	// 3 — GERAR NOVO QR CODE
	qrData, _, _ := callEvolution("GET", fmt.Sprintf("/instance/connect/%s", sessionName), nil)
	finalQR := extractQRCode(qrData)

	if finalQR == "" {
		time.Sleep(2 * time.Second)
		qrData, _, _ = callEvolution("GET", fmt.Sprintf("/instance/connect/%s", sessionName), nil)
		finalQR = extractQRCode(qrData)
	}

	if finalQR == "" {
		log.Printf("[NEXBOT] ❌ QR não retornado. Resposta da Evolution: %s", string(qrData))
		return c.Status(500).JSON(fiber.Map{"error": "Evolution não gerou QR. Veja os logs."})
	}

	if !strings.HasPrefix(finalQR, "data:image") {
		finalQR = "data:image/png;base64," + finalQR
	}

	// 4 — Atualizar banco
	db.Exec("UPDATE sessions SET status='QRCODE', qr_code=$1 WHERE user_id=$2",
		finalQR, userID)

	return c.JSON(fiber.Map{
		"status":  "QRCODE",
		"qr_code": finalQR,
	})
}

func deleteWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")

	var sessionName string
	db.QueryRow("SELECT session_name FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1", userID).
		Scan(&sessionName)

	if sessionName != "" {
		// Deslogar
		callEvolution("DELETE", fmt.Sprintf("/instance/logout/%s", sessionName), nil)
		time.Sleep(1 * time.Second)

		// Deletar
		callEvolution("DELETE", fmt.Sprintf("/instance/delete/%s", sessionName), nil)
	}

	// Remover do banco
	db.Exec("DELETE FROM sessions WHERE user_id=$1", userID)

	return c.JSON(fiber.Map{"message": "Instância excluída completamente!"})
}

func logoutWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var sessionName string
	db.QueryRow("SELECT session_name FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1", userID).Scan(&sessionName)
	if sessionName != "" {
		callEvolution("DELETE", fmt.Sprintf("/instance/logout/%s", sessionName), nil)
	}
	db.Exec("UPDATE sessions SET status='DISCONNECTED' WHERE user_id=$1", userID)
	return c.JSON(fiber.Map{"message": "Desconectado!"})
}

func extractQRCode(data []byte) string {
	// Tentar vários formatos
	var resp map[string]interface{}
	if json.Unmarshal(data, &resp) == nil {
		// Formato: { "base64": "..." }
		if v, ok := resp["base64"].(string); ok && v != "" {
			return v
		}
		// Formato: { "code": "..." } (se for QR longo)
		if v, ok := resp["code"].(string); ok && len(v) > 100 {
			return v
		}
		// Formato: { "qrcode": { "base64": "..." } }
		if qr, ok := resp["qrcode"].(map[string]interface{}); ok {
			if v, ok := qr["base64"].(string); ok && v != "" {
				return v
			}
		}
	}
	return ""
}

func extractPairingCode(data []byte) string {
	var resp map[string]interface{}
	if json.Unmarshal(data, &resp) == nil {
		// Formato: { "pairingCode": "ABCD1234" }
		if v, ok := resp["pairingCode"].(string); ok && v != "" {
			return v
		}
		// Formato: { "code": "ABCD1234" } (se for código curto)
		if v, ok := resp["code"].(string); ok && len(v) <= 10 {
			return v
		}
	}
	return ""
}

// Eclipse handlers
func saveEclipseSettings(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var req EclipseSettingsRequest
	c.BodyParser(&req)
	db.Exec("UPDATE clients SET eclipse_api_url=$1, eclipse_api_key=$2 WHERE user_id=$3", req.ApiUrl, req.ApiKey, userID)
	return c.JSON(fiber.Map{"message": "Salvo!"})
}

func getEclipseSettings(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var apiUrl, apiKey sql.NullString
	db.QueryRow("SELECT eclipse_api_url, eclipse_api_key FROM clients WHERE user_id=$1", userID).Scan(&apiUrl, &apiKey)
	return c.JSON(fiber.Map{"api_url": apiUrl.String, "api_key": apiKey.String})
}

func requestEclipseTrial(c *fiber.Ctx) error {
	var req EclipseTrialRequest
	c.BodyParser(&req)
	rand.Seed(time.Now().UnixNano())
	code := fmt.Sprintf("%06d", rand.Intn(1000000))
	hasher := sha256.New()
	hasher.Write([]byte(code))
	codeHash := hex.EncodeToString(hasher.Sum(nil))
	db.Exec("INSERT INTO email_verifications (email, code_hash, expires_at) VALUES ($1, $2, $3)", req.Email, codeHash, time.Now().Add(15*time.Minute))
	return c.JSON(fiber.Map{"message": "Código enviado!", "debug_code": code})
}

func verifyEmailCode(c *fiber.Ctx) error {
	var req VerifyCodeRequest
	c.BodyParser(&req)
	hasher := sha256.New()
	hasher.Write([]byte(req.Code))
	inputHash := hex.EncodeToString(hasher.Sum(nil))
	var id int
	err := db.QueryRow("SELECT id FROM email_verifications WHERE email=$1 AND code_hash=$2 AND expires_at > NOW() AND is_verified=FALSE", req.Email, inputHash).Scan(&id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Código inválido"})
	}
	db.Exec("UPDATE email_verifications SET is_verified=TRUE WHERE id=$1", id)
	return c.JSON(fiber.Map{"message": "Verificado!"})
}

func createEclipseTest(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var req CreateTestRequest
	c.BodyParser(&req)
	var apiUrl, apiKey sql.NullString
	db.QueryRow("SELECT eclipse_api_url, eclipse_api_key FROM clients WHERE user_id=$1", userID).Scan(&apiUrl, &apiKey)
	if !apiUrl.Valid {
		return c.Status(400).JSON(fiber.Map{"error": "Configure a API Eclipse"})
	}
	validade := 60
	if req.Duration > 0 {
		validade = req.Duration
	}
	payload := map[string]interface{}{"method": "CriarTest", "login": req.Login, "senha": req.Password, "limite": 1, "validade": validade, "valor": 0, "modo_conta": "ssh", "categoria": 1, "sendzap": true}
	jsonData, _ := json.Marshal(payload)
	client := &http.Client{Timeout: 10 * time.Second}
	httpReq, _ := http.NewRequest("POST", apiUrl.String, bytes.NewBuffer(jsonData))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("apikey", apiKey.String)
	resp, _ := client.Do(httpReq)
	if resp != nil {
		defer resp.Body.Close()
	}
	
	if resp == nil || resp.StatusCode != 200 {
		return c.Status(400).JSON(fiber.Map{"error": "Eclipse recusou"})
	}
	db.Exec(`INSERT INTO eclipse_tests (user_id, login_generated, password_generated, duration_minutes, status, expires_at) VALUES ($1, $2, $3, $4, 'active', NOW() + INTERVAL '1 minute' * $4)`, userID, req.Login, req.Password, validade)
	return c.JSON(fiber.Map{"success": true, "login": req.Login})
}

func listUsers(c *fiber.Ctx) error {
	rows, _ := db.Query("SELECT id, username, email, role FROM users ORDER BY id")
	defer rows.Close()
	var users []map[string]interface{}
	for rows.Next() {
		var id int
		var username, role string
		var email sql.NullString
		rows.Scan(&id, &username, &email, &role)
		users = append(users, map[string]interface{}{"id": id, "username": username, "email": email.String, "role": role})
	}
	return c.JSON(fiber.Map{"users": users})
}
