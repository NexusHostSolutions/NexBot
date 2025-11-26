-- Tabela de Usuários (Admin e Clientes)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'client', -- 'admin' ou 'client'
    email VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Tabela de Clientes (Dados adicionais)
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    document VARCHAR(20), -- CPF/CNPJ
    eclipse_api_url VARCHAR(255),
    eclipse_api_key VARCHAR(255),
    n8n_webhook_url VARCHAR(255),
    plan_id INT,
    plan_expires_at TIMESTAMP
);

-- Sessões do WhatsApp
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'disconnected', -- connected, qr_code, disconnected
    qr_code TEXT,
    settings JSONB DEFAULT '{}' -- config de recusar chamadas, online, etc
);

-- Grupos Gerenciados
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES sessions(id) ON DELETE CASCADE,
    jid VARCHAR(100) NOT NULL,
    name VARCHAR(100),
    members_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Membros de Grupos
CREATE TABLE groups_members (
    id SERIAL PRIMARY KEY,
    group_id INT REFERENCES groups(id) ON DELETE CASCADE,
    phone_number VARCHAR(20),
    role VARCHAR(20) DEFAULT 'member'
);

-- Fluxos de Conversa (Flow Builder)
CREATE TABLE flows (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    trigger_keyword VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Passos do Fluxo (Nodes)
CREATE TABLE flows_steps (
    id SERIAL PRIMARY KEY,
    flow_id INT REFERENCES flows(id) ON DELETE CASCADE,
    step_type VARCHAR(20), -- text, image, video, delay, condition
    content JSONB, -- O conteúdo da mensagem ou URL da mídia
    position_x INT,
    position_y INT,
    next_step_id INT
);

-- Produtos Financeiros
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100), -- Plano Mensal, Anual, etc
    connections_limit INT,
    price DECIMAL(10, 2),
    duration_days INT
);

-- Pagamentos
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    amount DECIMAL(10, 2),
    status VARCHAR(20), -- pending, paid, failed
    gateway VARCHAR(20), -- mercadopago, asaas, efi
    transaction_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plugins do Sistema
CREATE TABLE plugins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE, -- eclipse, financeiro, n8n
    description TEXT,
    is_global_enabled BOOLEAN DEFAULT FALSE
);

-- Plugins Habilitados por Usuário
CREATE TABLE plugins_enabled (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    plugin_id INT REFERENCES plugins(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, plugin_id)
);

-- Verificações de E-mail (Segurança para Trial 3 Dias)
CREATE TABLE email_verifications (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    attempts INT DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Testes Eclipse (VPN)
CREATE TABLE eclipse_tests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    login_generated VARCHAR(50),
    password_generated VARCHAR(50),
    duration_minutes INT, -- 120 ou 4320 (3 dias)
    status VARCHAR(20), -- active, expired, converted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Seed Inicial
INSERT INTO users (username, password_hash, role, email) VALUES 
('agoa', '$2a$10$X7V...HASH_DA_SENHA...', 'admin', 'admin@nexbot.com');

INSERT INTO products (name, connections_limit, price, duration_days) VALUES
('Plano Free', 1, 0.00, 30),
('Plano Mensal 1 Conexão', 1, 50.00, 30),
('Plano Mensal 2 Conexões', 2, 80.00, 30),
('Plano Semestral 1 Conexão', 1, 210.00, 180),
('Plano Anual 1 Conexão', 1, 420.00, 365);

INSERT INTO plugins (name, description) VALUES
('eclipse', 'Integração VPN Eclipse NexusHost'),
('financeiro', 'Gestão Financeira e Cobranças'),
('n8n', 'Integração de Webhooks e Automação');
