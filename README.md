# DSpace Converter API

API HTTP para converter um `input-forms.xml` do DSpace 5 em `submission-forms.xml` e `item-submission.xml` do DSpace 9. A API usa Node.js/TypeScript para HTTP e orquestração e preserva o motor Python existente.

## 🚀 Quick Start

### Requisitos

- Node.js 20 ou superior
- Python 3.10+ (Windows Store ou instalação padrão)
- npm

### Instalação

```bash
npm install
cp .env.example .env
```

No Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

### Iniciar servidor

```bash
npm run start
```

A API inicia em `http://localhost:3000` (health check em `/health`).

## 📡 API

### Conversão

Envie um multipart/form-data com o campo `file` e o arquivo chamado exatamente `input-forms.xml`:

```bash
curl -X POST http://localhost:3000/api/v1/conversions \
  -F "file=@./input-forms.xml" \
  --output dspace-conversion.zip
```

**Resposta:** ZIP contendo:
- `submission-forms.xml`
- `item-submission.xml`

### Erros

Formato: `{ "error": { "code": "...", "message": "..." } }`

Códigos:
- `INVALID_FILE` - Arquivo não é um XML válido ou não é DSpace 5
- `CONVERSION_FAILED` - Erro durante conversão Python
- `FILE_TOO_LARGE` - Arquivo excede limite
- `OUTPUT_VALIDATION_FAILED` - Saída inválida
- `INTERNAL_ERROR` - Erro interno do servidor

## 🏗️ Arquitetura

### Visão Geral

```
Cliente HTTP (curl ou outra aplicação)
    ↓
HTTP Controller (Presentation)
    ↓
Validador (DSpaceXmlValidator)
    ↓
Use Case (ConvertDspaceFiles)
    ↓
Python Engine → Python Scripts
    ↓
Archive Service
    ↓
Download ZIP
```

### Organização por responsabilidade

O código fica em três áreas. As dependências apontam para dentro: `conversion/` não conhece HTTP nem disco.

#### 1. **HTTP** (`src/http/`)
**Responsabilidade:** Receber requisições HTTP e enviar respostas

Arquivos:
- `ConversionController.ts` - Lê o multipart e chama o caso de uso
- `conversion.routes.ts` - Define as rotas da API
- `error-handler.ts` - Converte erros em respostas JSON (`{ error: { code, message } }`)

#### 2. **Conversão** (`src/conversion/`)
**Responsabilidade:** Regras da conversão, sem Fastify e sem acesso direto a disco

Arquivos:
- `ConvertDspaceFiles.ts` - Caso de uso: valida → converte → valida saída → compacta
- `DSpaceXmlValidator.ts` - Validações do XML de entrada e da saída
- `ports.ts` - Contratos (`IConversionEngine`, `IFileStorage`, `IArchiveService`)
- `errors.ts` - Erros da aplicação (`InvalidFileError` 400, `ConversionError` 422, `OutputValidationError`)
- `ConversionArtifactDTO.ts` - Resultado da conversão (caminho do ZIP e limpeza)

#### 3. **Adaptadores** (`src/adapters/`)
**Responsabilidade:** Implementar os contratos com tecnologias concretas

Arquivos:
- `PythonConversionEngine.ts` - Executa o Python via subprocess
- `LocalTemporaryStorage.ts` - Workspaces temporários em /tmp
- `ZipArchiveService.ts` - Compacta com archiver

Também em `src/`: `app.ts` (monta o Fastify), `server.ts` (inicia o servidor), `config.ts` (lê e valida as variáveis de ambiente) e `logger.ts` (opções do log Pino).

### Fluxo de Uma Requisição

```
1. POST /api/v1/conversions com arquivo XML
   ↓
2. ConversionController.handle()
   - Extrai arquivo multipart
   - Valida presença do campo "file"
   ↓
3. ConvertDspaceFiles.execute()
   - DSpaceXmlValidator.validate() → Verifica segurança + estrutura
   - Cria workspace temporário
   - LocalTemporaryStorage.writeInput() → Salva XML
   ↓
4. PythonConversionEngine.execute()
   - Executa: python python/run_conversion.py [input] [output_dir]
   - Captura stderr para debugging
   ↓
5. Validação de saída
   - Verifica se submission-forms.xml foi criado
   - Verifica se item-submission.xml foi criado
   - Valida XML de ambos
   ↓
6. ZipArchiveService.createZip()
   - Compacta os dois XMLs de saída
   ↓
7. Response
   - HTTP 200 + ZIP em anexo
   - ou erro (400/422) em JSON
   ↓
8. Cleanup
   - Remove workspace temporário
```

### Validação em Camadas

**Camada 1: Validator (DSpaceXmlValidator)**
```
✓ Nome do arquivo = "input-forms.xml"
✓ Tamanho: mínimo 100 bytes, máximo definido por `MAX_FILE_SIZE_MB`
✓ XML bem-formado
✓ Sem conteúdo suspeito (<script>, eval(), etc)
✓ Sem XXE (XML External Entity)
✓ Sem DTD malicioso
✓ Estrutura DSpace 5 (presença de <form-definitions> e <form-map>)
✓ Elemento raiz <input-forms>
```

**Camada 2: Caso de uso (ConvertDspaceFiles)**
```
✓ Confere se a saída do Python existe e é XML bem-formado
```

**Camada 3: Python Scripts**
```
✓ Lógica de transformação específica do DSpace
✓ Conversão de tipos de campo
✓ Normalização de estrutura
```

## ⚙️ Configuração

| Variável | Padrão | Descrição |
|---|---:|---|
| `HOST` | `0.0.0.0` | Interface de rede |
| `PORT` | `3000` | Porta HTTP |
| `PYTHON_BIN` | `python3` (Linux) / `python` (Windows) | Caminho Python |
| `MAX_FILE_SIZE_MB` | `10` | Tamanho máximo upload |
| `CONVERSION_TIMEOUT_MS` | `60000` | Timeout motor Python (ms) |
| `CORS_ORIGIN` | `http://localhost:5173` | Origens CORS, separadas por vírgula |
| `LOG_LEVEL` | `info` | Nível de log: `debug`, `info`, `warn`, `error` ou `silent` |

Valores numéricos inválidos (ex.: `PORT=abc`) impedem a inicialização do servidor, com uma mensagem que indica a variável.

### Exemplo .env

```env
HOST=0.0.0.0
PORT=3000
PYTHON_BIN=C:\Users\SEU_USUARIO\AppData\Local\Programs\Python\Python314\python.exe
MAX_FILE_SIZE_MB=10
CONVERSION_TIMEOUT_MS=60000
CORS_ORIGIN=http://localhost:5173,http://localhost:5500
```

## 🔒 Segurança

### Validações Implementadas

1. **XXE Prevention** - Bloqueia entidades externas XML
2. **Path Traversal** - Valida nome de arquivo (sem `../`)
3. **Script Injection** - Detecta `<script>`, `javascript:`, `eval()`
4. **DTD Blocking** - Bloqueia DOCTYPE externos
5. **Tamanho** - Limita upload ao valor de `MAX_FILE_SIZE_MB` (padrão 10MB)
6. **Formato** - Valida apenas XML com estrutura DSpace 5

### Boas Práticas em Produção

- ✅ HTTPS obrigatório
- ✅ CORS com whitelist de domínios específicos
- ✅ Rate limiting por IP
- ✅ Monitoramento de conversões falhadas
- ✅ Logs estruturados (Pino)
- ✅ Sem exposição pública sem autenticação

## 📝 Scripts

```bash
npm run dev        # Desenvolvimento com tsx watch
npm run build      # Compilar TypeScript
npm run start      # Produção (Node)
npm run test       # Testes
npm run lint       # ESLint
npm run format     # Prettier
```

## 🐍 Python Scripts

Localização: `python/`

- `run_conversion.py` - Orquestrador principal (CLI), valida entrada/saída
- `forms_converter.py` - Converte formulários (input-forms → submission-forms)
- `item_submission_converter.py` - Converte processos (input-forms → item-submission)

### Fluxo Python

```
run_conversion.py
  ├─ Valida input-forms.xml existe
  ├─ Cria diretório output/
  │
  ├─ PASSO 1: InputFormsToSubmissionFormsConverter
  │  └─ Transforma <page> → <row>
  │  └─ Normaliza input-types (twobox→name, checkbox→dropdown, etc)
  │  └─ Gera submission-forms.xml
  │
  ├─ PASSO 2: InputSubmissionToItemSubmissionConverter
  │  └─ Cria submission-map de form-map
  │  └─ Gera step-definitions
  │  └─ Gera item-submission.xml
  │
  ├─ Valida XMLs de saída
  └─ Retorna exit code 0 (sucesso) ou 1 (erro)
```

## 🧪 Testando

### Com curl

```bash
curl -X POST http://localhost:3000/api/v1/conversions \
  -F "file=@./input-forms.xml" \
  --output result.zip
```

### Debugging

Veja logs do servidor (formato JSON, via Pino):
```bash
npm run start
# Requisições rejeitadas: "level":40 com o código do erro (ex.: "code":"INVALID_FILE")
# Falhas do Python: "msg":"Erro na conversão Python", com stdout e stderr do script
```

## 📂 Estrutura de Pastas

```
dspace-converter-api/
├── src/
│   ├── server.ts              # Inicia o servidor
│   ├── app.ts                 # Monta o Fastify (rotas, plugins, erros)
│   ├── config.ts              # Lê e valida as variáveis de ambiente
│   ├── logger.ts              # Opções de log (Pino)
│   ├── http/                  # Camada HTTP
│   │   ├── ConversionController.ts
│   │   ├── conversion.routes.ts
│   │   └── error-handler.ts
│   ├── conversion/            # Regras da conversão
│   │   ├── ConvertDspaceFiles.ts
│   │   ├── DSpaceXmlValidator.ts
│   │   ├── ConversionArtifactDTO.ts
│   │   ├── errors.ts
│   │   └── ports.ts
│   └── adapters/              # Implementações técnicas
│       ├── PythonConversionEngine.ts
│       ├── LocalTemporaryStorage.ts
│       └── ZipArchiveService.ts
├── python/                    # Scripts Python da conversão
│   ├── run_conversion.py
│   ├── base_converter.py
│   ├── forms_converter.py
│   └── item_submission_converter.py
├── dist/                      # Saída compilada (TypeScript)
├── .env                     # Configuração (git-ignored)
├── package.json
├── tsconfig.json
└── README.md
```

## 🤝 Contribuindo

Ao adicionar features:
1. Mantenha a separação: código HTTP não entra em `conversion/`, e disco e processos ficam em `adapters/`
2. Adicione validações em `conversion/DSpaceXmlValidator.ts`
3. Novos contratos vão em `conversion/ports.ts`, e as implementações em `adapters/`
4. Escreva testes

## 📄 Licença

MIT
