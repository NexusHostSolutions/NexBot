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
	Number       string `json:"number"`
}

type EclipseSettingsRequest struct {
	ApiUrl string `json:"api_url"`
	ApiKey string `json:"api_key"`
}

type CreateTestRequest struct {
	Method    string  `json:"method"`
	Login     string  `json:"login"`
	Senha     string  `json:"senha"`
	Limite    int     `json:"limite"`
	Validade  int     `json:"validade"`
	Valor     float64 `json:"valor"`
	ModoConta string  `json:"modo_conta"`
	Numero    string  `json:"numero"`
	Categoria int     `json:"categoria"`
	Periodo   int     `json:"periodo"`
	SendZap   bool    `json:"sendzap"`
	Xray      bool    `json:"xray"`
}

type EclipseTrialRequest struct{ Email string `json:"email"` }
type VerifyCodeRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

// ============================================
// NOVAS STRUCTS PARA FLOW BUILDER
// ============================================
// O campo Content é `json.RawMessage` para lidar com a entrada de string JSON
// do frontend, e o NextStepID é um ponteiro para facilitar a omissão no JSON.
type FlowStep struct {
	ID         int               `json:"id"`
	StepType   string            `json:"step_type"` // text, image, delay, condition, api
	Content    json.RawMessage   `json:"content"`   // json.RawMessage para receber o JSON como string e salvar como JSONB
	PositionX  int               `json:"position_x"`
	PositionY  int               `json:"position_y"`
	NextStepID *int              `json:"next_step_id,omitempty"` // OmitEmpty é crucial para que o frontend não envie "0"
}

type Flow struct {
	ID             int        `json:"id"`
	UserID         int        `json:"user_id"`
	Name           string     `json:"name"`
	IsActive       bool       `json:"is_active"`
	TriggerKeyword string     `json:"trigger_keyword"`
	CreatedAt      *time.Time `json:"created_at"`
	Steps          []FlowStep `json:"steps"` // Usado apenas para operações de save/load
}

// ============================================
// MAIN
// ============================================
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
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS number VARCHAR(20);`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS profile_status TEXT;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS reject_call BOOLEAN DEFAULT FALSE;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS msg_call TEXT DEFAULT '';`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS groups_ignore BOOLEAN DEFAULT FALSE;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS always_online BOOLEAN DEFAULT FALSE;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS read_messages BOOLEAN DEFAULT FALSE;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS read_status BOOLEAN DEFAULT FALSE;`)
	db.Exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS qr_code TEXT;`)
	
	db.Exec(`CREATE TABLE IF NOT EXISTS eclipse_tests (
		id SERIAL PRIMARY KEY,
		user_id INT,
		login_generated VARCHAR(255),
		password_generated VARCHAR(255),
		duration_minutes INT,
		status VARCHAR(50),
		expires_at TIMESTAMP
	);`)
	
	// Migrations para Flow Builder
	db.Exec(`CREATE TABLE IF NOT EXISTS flows (
		id SERIAL PRIMARY KEY,
		user_id INT REFERENCES users(id) ON DELETE CASCADE,
		name VARCHAR(100) NOT NULL,
		is_active BOOLEAN DEFAULT TRUE,
		trigger_keyword VARCHAR(50),
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`)
	db.Exec(`CREATE TABLE IF NOT EXISTS flows_steps (
		id SERIAL PRIMARY KEY,
		flow_id INT REFERENCES flows(id) ON DELETE CASCADE,
		step_type VARCHAR(20), 
		content JSONB,
		position_x INT,
		position_y INT,
		next_step_id INT REFERENCES flows_steps(id)
	);`)


	app := fiber.New(fiber.Config{AppName: "NexBot API v2.1 (Flows)"})
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))
	app.Use(logger.New())

	api := app.Group("/api/nexbot")
	api.Post("/auth/login", login)
	v1 := api.Group("/", authMiddleware)

	// Rotas do WhatsApp
	v1.Get("/whatsapp", getWhatsApp)
	v1.Post("/whatsapp/connect", connectWhatsApp)
	v1.Post("/whatsapp/reconnect", reconnectWhatsApp)
	v1.Put("/whatsapp/settings", updateWhatsAppSettings)
	v1.Post("/whatsapp/settings", updateWhatsAppSettings) // Permite POST também
	v1.Post("/whatsapp/logout", logoutWhatsApp)
	v1.Post("/whatsapp/restart", restartWhatsApp)
	v1.Post("/whatsapp/delete", deleteWhatsApp)

	// Rotas do Eclipse
	v1.Post("/eclipse/settings", saveEclipseSettings)
	v1.Get("/eclipse/settings", getEclipseSettings)
	v1.Post("/eclipse/request-trial", requestEclipseTrial)
	v1.Post("/verify-email-code", verifyEmailCode)
	v1.Post("/eclipse/create-test", createEclipseTest)
	v1.Get("/admin/users", listUsers)

	// ============================================
	// NOVAS ROTAS DO FLOW BUILDER
	// ============================================
	v1.Get("/flows", listFlows)
	v1.Post("/flows", saveFlow) // Cria ou Atualiza
	v1.Get("/flows/:id", getFlow)
	v1.Delete("/flows/:id", deleteFlow)

	log.Println("🚀 NexBot API v2.1 (Flows) iniciando na porta 8080...")
	log.Fatal(app.Listen(":8080"))
}

// ... [Funções callEvolution, truncateLog, authMiddleware, login, getWhatsApp, connectWhatsApp, reconnectWhatsApp, updateWhatsAppSettings, restartWhatsApp, deleteWhatsApp, logoutWhatsApp, extractQRCode, extractPairingCode, saveEclipseSettings, getEclipseSettings, requestEclipseTrial, verifyEmailCode, createEclipseTest, findXrayRecursive, findXrayInString, listUsers] ...

// ============================================
// CRUD FLOW BUILDER
// ============================================

// POST /flows - Cria ou atualiza um fluxo completo
func saveFlow(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)
	var flowReq Flow
	// CORREÇÃO: Usar um BodyParser que permita o `json.RawMessage` no campo Content
	// Como FlowStep.Content é json.RawMessage, ele aceitará a string JSON do frontend.
	if err := c.BodyParser(&flowReq); err != nil {
		log.Printf("Erro ao parsear body: %v", err)
		return c.Status(400).JSON(fiber.Map{"error": "Dados do fluxo inválidos ou malformados no JSON"})
	}

	if flowReq.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "O nome do fluxo é obrigatório"})
	}
	
	tx, err := db.Begin()
	if err != nil { return c.Status(500).JSON(fiber.Map{"error": "Erro ao iniciar transação"}) }

	var flowID int
	if flowReq.ID > 0 {
		// Atualizar fluxo existente
		_, err = tx.Exec("UPDATE flows SET name=$1, is_active=$2, trigger_keyword=$3 WHERE id=$4 AND user_id=$5",
			flowReq.Name, flowReq.IsActive, flowReq.TriggerKeyword, flowReq.ID, userID)
		flowID = flowReq.ID
		// Limpar passos antigos
		_, err = tx.Exec("DELETE FROM flows_steps WHERE flow_id=$1", flowID)
		if err != nil { tx.Rollback(); return c.Status(500).JSON(fiber.Map{"error": "Falha ao limpar passos antigos"}) }
	} else {
		// Criar novo fluxo
		err = tx.QueryRow(
			"INSERT INTO flows (user_id, name, is_active, trigger_keyword) VALUES ($1, $2, $3, $4) RETURNING id",
			userID, flowReq.Name, flowReq.IsActive, flowReq.TriggerKeyword,
		).Scan(&flowID)
	}

	if err != nil { tx.Rollback(); return c.Status(500).JSON(fiber.Map{"error": "Falha ao salvar o fluxo"}) }
	
	// Mapeamento temporário para armazenar IDs antigos e novos dos passos
	idMap := make(map[int]int) 
	
	// 1. Inserir todos os passos e coletar os novos IDs
	for i := range flowReq.Steps {
		step := &flowReq.Steps[i]
		oldID := step.ID // Salva o ID temporário do frontend
		
		// O Content já é json.RawMessage, que é essencialmente []byte que representa o JSON.
		// Não precisamos do json.Marshal, apenas o usamos diretamente (como []byte) no Exec.
		contentBytes := step.Content

		var newID int
		err = tx.QueryRow(
			"INSERT INTO flows_steps (flow_id, step_type, content, position_x, position_y) VALUES ($1, $2, $3, $4, $5) RETURNING id",
			flowID, step.StepType, contentBytes, step.PositionX, step.PositionY,
		).Scan(&newID)

		if err != nil { tx.Rollback(); return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Falha ao salvar passo %d: %v", oldID, err)}) }

		idMap[oldID] = newID // Mapeia ID temporário para ID real do DB
		step.ID = newID      // Atualiza a struct com o ID real
	}

	// 2. Atualizar as referências next_step_id
	for _, step := range flowReq.Steps {
		// CORREÇÃO: O NextStepID é um ponteiro. Verifica se o ponteiro não é nulo.
		if step.NextStepID != nil && *step.NextStepID > 0 { 
			oldNextID := *step.NextStepID
			if newNextID, ok := idMap[oldNextID]; ok {
				// Atualiza a referência com o novo ID
				_, err = tx.Exec("UPDATE flows_steps SET next_step_id=$1 WHERE id=$2", newNextID, step.ID)
				if err != nil { tx.Rollback(); return c.Status(500).JSON(fiber.Map{"error": "Falha ao vincular passos"}) }
			} else {
				// Se o next_step_id não for mapeado, deve ser uma nova conexão para um nó novo que acabou de ser inserido.
				// Como mapeamos todos os novos IDs no passo 1, se não estiver aqui, é um erro de lógica do frontend ou
				// a conexão aponta para um nó deletado. Omitimos silenciosamente.
				log.Printf("[SAVE FLOW] Aviso: NextStepID %d não encontrado no mapa de IDs, ignorando vinculo para passo %d", oldNextID, step.ID)
			}
		} else {
			// Se NextStepID for nil (o que acontece se o frontend omitir o campo) ou 0, garante que o campo seja NULL no DB.
			_, err = tx.Exec("UPDATE flows_steps SET next_step_id=NULL WHERE id=$1", step.ID)
			if err != nil { tx.Rollback(); return c.Status(500).JSON(fiber.Map{"error": "Falha ao desvincular passos"}) }
		}
	}

	if err := tx.Commit(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Falha ao finalizar transação"})
	}

	return c.Status(200).JSON(fiber.Map{"id": flowID, "message": "Fluxo salvo com sucesso"})
}

// GET /flows - Lista todos os fluxos do usuário
func listFlows(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)
	rows, err := db.Query(`
		SELECT id, name, is_active, trigger_keyword, created_at
		FROM flows WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	
	if err != nil { return c.Status(500).JSON(fiber.Map{"error": "Falha ao listar fluxos"}) }
	defer rows.Close()

	var flows []Flow
	for rows.Next() {
		var f Flow
		var keyword sql.NullString
		if err := rows.Scan(&f.ID, &f.Name, &f.IsActive, &keyword, &f.CreatedAt); err != nil {
			log.Printf("[DB ERROR] Falha ao scanear fluxo: %v", err)
			continue
		}
		f.UserID = userID
		f.TriggerKeyword = keyword.String
		flows = append(flows, f)
	}

	return c.JSON(fiber.Map{"flows": flows})
}

// GET /flows/:id - Obtém um fluxo e seus passos
func getFlow(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)
	flowID := c.Params("id")

	var f Flow
	var keyword sql.NullString

	// 1. Busca os dados principais do fluxo
	err := db.QueryRow(`
		SELECT id, name, is_active, trigger_keyword, created_at
		FROM flows WHERE id=$1 AND user_id=$2`, flowID, userID).
		Scan(&f.ID, &f.Name, &f.IsActive, &keyword, &f.CreatedAt)

	if err == sql.ErrNoRows {
		return c.Status(404).JSON(fiber.Map{"error": "Fluxo não encontrado"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Falha ao buscar fluxo"})
	}

	f.UserID = userID
	f.TriggerKeyword = keyword.String

	// 2. Busca os passos associados
	stepRows, err := db.Query(`
		SELECT id, step_type, content, position_x, position_y, next_step_id 
		FROM flows_steps WHERE flow_id=$1`, flowID)

	if err != nil { return c.Status(500).JSON(fiber.Map{"error": "Falha ao buscar passos"}) }
	defer stepRows.Close()

	var steps []FlowStep
	for stepRows.Next() {
		var s FlowStep
		var contentJSON []byte
		var nextStepID sql.NullInt32

		if err := stepRows.Scan(&s.ID, &s.StepType, &contentJSON, &s.PositionX, &s.PositionY, &nextStepID); err != nil {
			log.Printf("[DB ERROR] Falha ao scanear passo: %v", err)
			continue
		}
		
		// O campo Content é json.RawMessage, aceita o []byte do DB diretamente
		s.Content = contentJSON 

		if nextStepID.Valid {
			tempNextID := int(nextStepID.Int32)
			s.NextStepID = &tempNextID
		} else {
			s.NextStepID = nil // Garante que será nil se for NULL no DB
		}
		
		steps = append(steps, s)
	}
	f.Steps = steps

	return c.JSON(f)
}

// DELETE /flows/:id - Exclui um fluxo e seus passos
func deleteFlow(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)
	flowID := c.Params("id")

	// O CASCADE DELETE nas tabelas flows_steps e flows faz a mágica:
	// Apenas deletamos o fluxo, e o banco se encarrega dos passos.
	result, err := db.Exec("DELETE FROM flows WHERE id=$1 AND user_id=$2", flowID, userID)
	
	if err != nil {
		log.Printf("[DB ERROR] Falha ao deletar fluxo: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Falha ao excluir fluxo"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Fluxo não encontrado ou não pertence ao usuário"})
	}

	return c.JSON(fiber.Map{"message": "Fluxo excluído com sucesso"})
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
		// CORREÇÃO DE ERRO: Se o body for json.RawMessage (vindo do FlowStep), ele já é um JSON válido.
		// Precisamos verificar o tipo.
		if raw, ok := body.(json.RawMessage); ok {
			jsonData = raw
		} else {
			// Caso contrário, faz o marshal normal.
			jsonData, _ = json.Marshal(body)
		}
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

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[EVOLUTION] Erro: %v", err)
		return nil, 0, err
	}
	defer resp.Body.Close()
	respData, _ := io.ReadAll(resp.Body)

	if resp.StatusCode > 299 {
		log.Printf("[EVOLUTION] Erro Status %d: %s", resp.StatusCode, truncateLog(string(respData), 200))
	}

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

func getWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var s WhatsAppSession

	err := db.QueryRow(`
		SELECT session_name, status,
			   COALESCE(profile_pic, ''), COALESCE(profile_name, ''), COALESCE(profile_status, ''),
			   COALESCE(number, ''),
			   COALESCE(reject_call, false), COALESCE(msg_call, ''), COALESCE(groups_ignore, false),
			   COALESCE(always_online, false), COALESCE(read_messages, false), COALESCE(read_status, false),
			   COALESCE(qr_code, '')
		FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1`, userID).
		Scan(&s.SessionName, &s.Status, &s.ProfilePic, &s.ProfileName, &s.ProfileStatus,
			&s.Number, &s.RejectCall, &s.MsgCall, &s.GroupsIgnore, &s.AlwaysOnline, &s.ReadMessages, &s.ReadStatus, &s.QrCode)

	if err == sql.ErrNoRows || s.SessionName == "" {
		return c.JSON(fiber.Map{"status": "NO_INSTANCE"})
	}

	data, code, _ := callEvolution("GET", fmt.Sprintf("/instance/fetchInstances?instanceName=%s", s.SessionName), nil)

	if code == 200 {
		var instances []struct {
			ConnectionStatus string `json:"connectionStatus"`
			Status           string `json:"status"`
			State            string `json:"state"`
			ProfileName      string `json:"profileName"`
			ProfilePicUrl    string `json:"profilePicUrl"`
			ProfileStatus    string `json:"profileStatus"`
			Number           string `json:"number"`
			OwnerJid         string `json:"ownerJid"`
		}

		if json.Unmarshal(data, &instances) == nil && len(instances) > 0 {
			inst := instances[0]
			statusRaw := strings.ToLower(inst.ConnectionStatus)
			if statusRaw == "" { statusRaw = strings.ToLower(inst.Status) }
			if statusRaw == "" { statusRaw = strings.ToLower(inst.State) }

			newStatus := "DISCONNECTED"
			if statusRaw == "open" || statusRaw == "connected" {
				newStatus = "CONNECTED"
			} else if statusRaw == "connecting" {
				newStatus = "CONNECTING"
			}

			pic := inst.ProfilePicUrl
			name := inst.ProfileName
			pStatus := inst.ProfileStatus
			number := inst.Number

			if number == "" && inst.OwnerJid != "" {
				parts := strings.Split(inst.OwnerJid, "@")
				if len(parts) > 0 { number = parts[0] }
			}

			if pic == "" { pic = s.ProfilePic }
			if pic == "" && newStatus == "CONNECTED" {
				pic = "https://ui-avatars.com/api/?name=" + s.SessionName + "&background=10b981&color=fff&size=200"
			}
			if name == "" { name = s.ProfileName }
			if name == "" { name = s.SessionName }
			if number == "" { number = s.Number }

			db.Exec(`UPDATE sessions SET status=$1, profile_name=$2, profile_pic=$3, profile_status=$4, number=$5 WHERE user_id=$6`,
				newStatus, name, pic, pStatus, number, userID)

			s.Status = newStatus
			s.ProfileName = name
			s.ProfilePic = pic
			s.ProfileStatus = pStatus
			s.Number = number

			if newStatus == "CONNECTED" {
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

	return c.JSON(s)
}

func connectWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var req ConnectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Dados inválidos"})
	}

	instanceName := strings.ReplaceAll(req.InstanceName, " ", "")
	if instanceName == "" { instanceName = "NexBotDefault" }

	phoneToUse := req.PhoneNumber
	if phoneToUse == "" { phoneToUse = req.Number }

	reg, _ := regexp.Compile("[^0-9]+")
	cleanNumber := reg.ReplaceAllString(phoneToUse, "")
	if cleanNumber != "" && !strings.HasPrefix(cleanNumber, "55") {
		cleanNumber = "55" + cleanNumber
	}

	if len(instanceName) < 3 {
		return c.Status(400).JSON(fiber.Map{"error": "Nome muito curto (mínimo 3 caracteres)."})
	}
	
	if req.Method == "pairing" || req.Method == "create" {
		if cleanNumber == "" || len(cleanNumber) < 12 {
			return c.Status(400).JSON(fiber.Map{"error": "Número inválido."})
		}
	}

	log.Printf("[NEXBOT] Criando instância: %s | Número: %s", instanceName, cleanNumber)

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

	createPayload := map[string]interface{}{
		"instanceName": instanceName,
		"token":        "nexbot-" + instanceName,
		"qrcode":       req.Method == "qrcode",
		"number":       cleanNumber,
		"integration":  "WHATSAPP-BAILEYS",
	}

	createResp, status, err := callEvolution("POST", "/instance/create", createPayload)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "NexBot indisponível"})
	}

	if status != 201 && status != 200 {
		log.Printf("[NEXBOT] Erro ao criar: %d - %s", status, string(createResp))
		return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Erro ao criar instância (status %d)", status)})
	}

	var sessionId int
	db.QueryRow("SELECT id FROM sessions WHERE user_id=$1", userID).Scan(&sessionId)
	if sessionId == 0 {
		db.Exec(`INSERT INTO sessions (user_id, session_name, status, number) VALUES ($1, $2, 'DISCONNECTED', $3)`, userID, instanceName, cleanNumber)
	} else {
		db.Exec(`UPDATE sessions SET session_name=$1, status='DISCONNECTED', number=$2 WHERE id=$3`, instanceName, cleanNumber, sessionId)
	}

	time.Sleep(1 * time.Second)
	result := fiber.Map{"status": "CREATED", "instance": instanceName}

	if req.Method == "create" {
		return c.JSON(result)
	}

	if req.Method == "qrcode" || req.Method == "" {
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

	if req.Method == "pairing" {
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

func reconnectWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")

	var req ConnectRequest
	c.BodyParser(&req)

	var sessionName, dbNumber string
	db.QueryRow("SELECT session_name, COALESCE(number, '') FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1", userID).Scan(&sessionName, &dbNumber)

	if sessionName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Nenhuma instância encontrada"})
	}

	phoneToUse := req.PhoneNumber
	if phoneToUse == "" { phoneToUse = req.Number }
	if phoneToUse == "" { phoneToUse = dbNumber }

	reg, _ := regexp.Compile("[^0-9]+")
	cleanNumber := reg.ReplaceAllString(phoneToUse, "")
	if cleanNumber != "" && !strings.HasPrefix(cleanNumber, "55") {
		cleanNumber = "55" + cleanNumber
	}

	log.Printf("[NEXBOT] Reconectando %s | Método: %s | Número: %s", sessionName, req.Method, cleanNumber)

	if cleanNumber != "" && cleanNumber != dbNumber {
		db.Exec("UPDATE sessions SET number=$1 WHERE user_id=$2", cleanNumber, userID)
	}

	fetchData, fetchCode, _ := callEvolution("GET", fmt.Sprintf("/instance/fetchInstances?instanceName=%s", sessionName), nil)

	if fetchCode != 200 {
		log.Printf("[NEXBOT] Instância não existe na Evolution, recriando...")
		createPayload := map[string]interface{}{
			"instanceName": sessionName,
			"token":        "nexbot-" + sessionName,
			"qrcode":       req.Method != "pairing",
			"number":       cleanNumber,
			"integration":  "WHATSAPP-BAILEYS",
		}
		_, createStatus, _ := callEvolution("POST", "/instance/create", createPayload)
		if createStatus != 200 && createStatus != 201 {
			return c.Status(500).JSON(fiber.Map{"error": "Falha ao recriar instância"})
		}
		time.Sleep(2 * time.Second)
	} else {
		var instances []struct { ConnectionStatus string `json:"connectionStatus"` }
		if json.Unmarshal(fetchData, &instances) == nil && len(instances) > 0 {
			if strings.ToLower(instances[0].ConnectionStatus) == "open" {
				db.Exec("UPDATE sessions SET status='CONNECTED' WHERE user_id=$1", userID)
				return c.JSON(fiber.Map{"status": "CONNECTED", "message": "Já está conectado!"})
			}
		}
	}

	if req.Method == "pairing" {
		if cleanNumber == "" || len(cleanNumber) < 12 {
			return c.Status(400).JSON(fiber.Map{"error": "Número inválido para pareamento."})
		}

		pairData, pairStatus, _ := callEvolution("GET", fmt.Sprintf("/instance/connect/%s?number=%s", sessionName, cleanNumber), nil)
		if pairStatus != 200 && pairStatus != 201 {
			pairData, _, _ = callEvolution("POST", fmt.Sprintf("/instance/connect/%s", sessionName), map[string]string{"number": cleanNumber})
		}

		code := extractPairingCode(pairData)
		if code == "" {
			return c.Status(500).JSON(fiber.Map{"error": "Falha ao gerar Código de Pareamento."})
		}

		code = strings.ToUpper(strings.TrimSpace(code))
		if len(code) == 8 && !strings.Contains(code, "-") {
			code = code[:4] + "-" + code[4:]
		}

		db.Exec("UPDATE sessions SET status='PAIRING' WHERE user_id=$1", userID)
		return c.JSON(fiber.Map{
			"status":       "PAIRING",
			"pairing_code": code,
		})
	}

	qrData, _, _ := callEvolution("GET", fmt.Sprintf("/instance/connect/%s", sessionName), nil)
	finalQR := extractQRCode(qrData)

	if finalQR == "" {
		time.Sleep(2 * time.Second)
		qrData, _, _ = callEvolution("GET", fmt.Sprintf("/instance/connect/%s", sessionName), nil)
		finalQR = extractQRCode(qrData)
	}

	if finalQR == "" {
		return c.Status(500).JSON(fiber.Map{"error": "QR Code não disponível. Tente novamente."})
	}

	if !strings.HasPrefix(finalQR, "data:image") {
		finalQR = "data:image/png;base64," + finalQR
	}

	db.Exec("UPDATE sessions SET status='QRCODE', qr_code=$1 WHERE user_id=$2", finalQR, userID)

	return c.JSON(fiber.Map{
		"status":  "QRCODE",
		"qr_code": finalQR,
	})
}

// ============================================
// FUNÇÃO DE CONFIGURAÇÃO CORRIGIDA
// ============================================
func updateWhatsAppSettings(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var req WhatsAppSettingsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Dados inválidos"})
	}

	// 1. Busca o nome da sessão (usando a mesma lógica de getWhatsApp)
	var sessionName string
	err := db.QueryRow("SELECT session_name FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1", userID).Scan(&sessionName)

	if err != nil || sessionName == "" {
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
		return c.Status(500).JSON(fiber.Map{"error": "Falha ao atualizar configurações na Evolution"})
	}

	// 2. CORREÇÃO: Atualiza via user_id para garantir consistência
	// Se houver múltiplas sessões antigas, atualiza todas do usuário para evitar conflitos visuais no painel
	_, err = db.Exec(`UPDATE sessions SET reject_call=$1, msg_call=$2, groups_ignore=$3, always_online=$4, read_messages=$5, read_status=$6 WHERE user_id=$7`,
		req.RejectCall, req.MsgCall, req.GroupsIgnore, req.AlwaysOnline, req.ReadMessages, req.ReadStatus, userID)

	if err != nil {
		log.Printf("[DB ERRO] Falha ao salvar settings: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao salvar no banco de dados"})
	}

	return c.JSON(fiber.Map{"message": "Configurações salvas com sucesso!"})
}

func restartWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var sessionName string

	db.QueryRow("SELECT session_name FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1", userID).Scan(&sessionName)

	if sessionName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Nenhuma instância encontrada"})
	}

	payload := map[string]interface{}{}
	resp, code, err := callEvolution("POST", fmt.Sprintf("/instance/restart/%s", sessionName), payload)

	if err != nil {
		log.Printf("[RESTART] Erro ao chamar Evolution: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Falha ao reiniciar a instância (erro de comunicação)"})
	}

	if code != 200 && code != 201 {
		log.Printf("[RESTART] Evolution retornou erro %d: %s", code, string(resp))
		return c.Status(500).JSON(fiber.Map{"error": "Evolution não conseguiu reiniciar a instância"})
	}

	return c.JSON(fiber.Map{"message": "Instância reiniciada com sucesso!"})
}

func deleteWhatsApp(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var sessionName string
	db.QueryRow("SELECT session_name FROM sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 1", userID).Scan(&sessionName)
	if sessionName != "" {
		callEvolution("DELETE", fmt.Sprintf("/instance/logout/%s", sessionName), nil)
		time.Sleep(1 * time.Second)
		callEvolution("DELETE", fmt.Sprintf("/instance/delete/%s", sessionName), nil)
	}
	db.Exec("DELETE FROM sessions WHERE user_id=$1", userID)
	db.Exec("INSERT INTO sessions (user_id, session_name, status, number) VALUES ($1, '', 'DISCONNECTED', '')", userID)

	return c.JSON(fiber.Map{"message": "Instância deletada e desconectada!"})
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
	var resp map[string]interface{}
	if json.Unmarshal(data, &resp) == nil {
		if v, ok := resp["base64"].(string); ok && v != "" {
			return v
		}
		if v, ok := resp["code"].(string); ok && len(v) > 100 {
			return v
		}
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
		if v, ok := resp["pairingCode"].(string); ok && v != "" {
			return v
		}
		if v, ok := resp["code"].(string); ok && len(v) <= 10 {
			return v
		}
	}
	return ""
}

func saveEclipseSettings(c *fiber.Ctx) error {
	userID := c.Locals("user_id")
	var req EclipseSettingsRequest

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Dados inválidos"})
	}

	if req.ApiUrl == "" || req.ApiKey == "" {
		return c.Status(400).JSON(fiber.Map{"error": "URL e API Key são obrigatórios!"})
	}

	testPayload := map[string]string{
		"method": "listarUsers",
		"tipo":   "all",
	}
	jsonPayload, _ := json.Marshal(testPayload)

	client := &http.Client{Timeout: 10 * time.Second}
	testReq, _ := http.NewRequest("POST", req.ApiUrl, bytes.NewBuffer(jsonPayload))
	testReq.Header.Set("Content-Type", "application/json")
	testReq.Header.Set("apikey", req.ApiKey)

	log.Printf("[ECLIPSE] Testando conexão em %s", req.ApiUrl)
	resp, err := client.Do(testReq)

	if err != nil {
		log.Printf("[ECLIPSE] Erro de rede: %v", err)
		return c.Status(400).JSON(fiber.Map{"error": "Não foi possível conectar na URL informada."})
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Printf("[ECLIPSE] API Recusou. Status: %d", resp.StatusCode)
		return c.Status(400).JSON(fiber.Map{"error": "A API do Eclipse recusou a conexão. Verifique a API Key."})
	}

	db.Exec("UPDATE clients SET eclipse_api_url=$1, eclipse_api_key=$2 WHERE user_id=$3", req.ApiUrl, req.ApiKey, userID)
	return c.JSON(fiber.Map{"message": "Conexão Aprovada e Salva!"})
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

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Dados inválidos"})
	}

	var apiUrl, apiKey sql.NullString
	db.QueryRow("SELECT eclipse_api_url, eclipse_api_key FROM clients WHERE user_id=$1", userID).Scan(&apiUrl, &apiKey)

	if !apiUrl.Valid || apiUrl.String == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Configure a API Eclipse primeiro"})
	}
	if !apiKey.Valid || apiKey.String == "" {
		return c.Status(400).JSON(fiber.Map{"error": "API Key não configurada"})
	}

	method := req.Method
	if method == "" { method = "CriarTest" }
	if req.Limite == 0 { req.Limite = 1 }
	if req.Validade == 0 { req.Validade = 60 }
	if req.ModoConta == "" { req.ModoConta = "ssh" }
	if req.Categoria == 0 { req.Categoria = 1 }

	sendXray := req.Xray
	if strings.Contains(strings.ToLower(req.ModoConta), "xray") {
		sendXray = true
	}

	payload := map[string]interface{}{
		"method":     method,
		"login":      req.Login,
		"senha":      req.Senha,
		"limite":     req.Limite,
		"validade":   req.Validade,
		"valor":      req.Valor,
		"modo_conta": req.ModoConta,
		"categoria":  req.Categoria,
		"sendzap":    req.SendZap,
		"xray":       sendXray,
		"numero":     req.Numero, 
	}

	if method == "CriarUser" && req.Periodo > 0 { payload["periodo"] = req.Periodo }

	log.Printf("[ECLIPSE] Novo pedido: %s | Xray: %v", req.Login, sendXray)

	jsonData, _ := json.Marshal(payload)
	client := &http.Client{Timeout: 15 * time.Second}
	httpReq, err := http.NewRequest("POST", apiUrl.String, bytes.NewBuffer(jsonData))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao criar requisição"})
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("apikey", apiKey.String)

	resp, err := client.Do(httpReq)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "Não foi possível conectar à API Eclipse"})
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	
	if resp.StatusCode != 200 {
		log.Printf("[ECLIPSE] Erro API (%d): %s", resp.StatusCode, string(respBody))
		return c.Status(400).JSON(fiber.Map{"error": "API recusou a operação"})
	}

	cleanBody := respBody
	jsonStart := bytes.IndexByte(respBody, '{')
	if jsonStart > 0 {
		cleanBody = respBody[jsonStart:]
	}

	var eclipseResp map[string]interface{}
	d := json.NewDecoder(bytes.NewReader(cleanBody))
	d.UseNumber()
	err = d.Decode(&eclipseResp)
	
	db.Exec(`INSERT INTO eclipse_tests (user_id, login_generated, password_generated, duration_minutes, status, expires_at) 
		VALUES ($1, $2, $3, $4, 'active', NOW() + INTERVAL '1 minute' * $4)`,
		userID, req.Login, req.Senha, req.Validade)

	finalXray := ""
	if eclipseResp != nil {
		finalXray = findXrayRecursive(eclipseResp)
	} else {
		finalXray = findXrayInString(string(respBody))
	}

	return c.JSON(fiber.Map{
		"success":   true,
		"login":     req.Login,
		"senha":     req.Senha,
		"xray":      finalXray,
	})
}

func findXrayRecursive(data interface{}) string {
	if data == nil { return "" }

	if m, ok := data.(map[string]interface{}); ok {
		if val, ok := m["xray"].(string); ok && val != "" { return val }
		if val, ok := m["v2ray"].(string); ok && val != "" { return val }
		for _, v := range m {
			if res := findXrayRecursive(v); res != "" { return res }
		}
	}

	if l, ok := data.([]interface{}); ok {
		for _, v := range l {
			if res := findXrayRecursive(v); res != "" { return res }
		}
	}

	if s, ok := data.(string); ok {
		s = strings.TrimSpace(s)
		if len(s) > 2 && (strings.HasPrefix(s, "{") || strings.HasPrefix(s, "[")) {
			var nested interface{}
			if json.Unmarshal([]byte(s), &nested) == nil {
				return findXrayRecursive(nested)
			}
		}
	}
	return ""
}

func findXrayInString(raw string) string {
	re := regexp.MustCompile(`"xray"\s*:\s*"([^"]+)"`)
	matches := re.FindStringSubmatch(raw)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
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