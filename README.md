# CodeOllie CLI 🎉

A highly intelligent AI-powered CLI coding assistant that can create and edit files in your project. Authenticate with GitHub and get instant coding help with support for multiple AI providers (OpenRouter, OpenAI, NVIDIA NIM, Google Gemini, and Hugging Face).

## Features

✨ **Multi-Provider AI Support** — OpenRouter, OpenAI, NVIDIA NIM, Google Gemini, Hugging Face  
🔐 **GitHub Authentication** — Secure OAuth login via browser (Device Flow)  
📝 **File Management** — Create and edit files with intelligent suggestions  
💬 **Interactive Chat** — Multi-turn conversation with context awareness  
⚙️ **Dynamic Model Selection** — Switch models with `/model` command  
🚀 **Easy Setup** — First-run onboarding guides you through provider setup  

## Installation

Download and run the .msi in the latest stable release on this GitHub repo for Windows
We are still developing for macOS
## Setup

### First-Run Onboarding

When you run the command `CodeOllie` for the first time, you'll be guided through:

1. **GitHub Authentication** — Authenticate securely with GitHub via Device Flow
2. **Provider Selection** — Choose from OpenRouter, OpenAI, NVIDIA NIM, Google Gemini, or Hugging Face
3. **API Key Setup** — Enter your API key for the selected provider
4. **Model Selection** — Pick a compatible model for your provider

Your configuration is saved to `~/.codeollie/config.json` for future use.

### Supported Providers

| Provider | Models | Notes |
|----------|--------|-------|
| **OpenRouter** | Nemotron 3 Ultra, GPT-4, Claude 3 | Proxy for multiple models |
| **OpenAI** | GPT-4, GPT-4 Turbo, GPT-3.5 Turbo | Direct OpenAI API |
| **NVIDIA NIM** | Nemotron 3 Ultra, 70B | NVIDIA's model inference |
| **Google Gemini** | Gemini Pro, Gemini Pro Vision | Google's latest models |
| **Hugging Face** | SGM-1 (custom MoE) | Custom spaces and endpoints |

## Usage

### Basic Commands

Start the interactive chat:
```bash
CodeOllie
```

This will:
1. 🔐 Authenticate with GitHub (if needed)
2. 💬 Start an interactive chat interface
3. 📝 Help you create and edit files

### Slash Commands

Inside the CodeOllie chat, use slash commands:

- **`/model`** — Opens the model selection menu to switch providers/models
- **`exit`** — Quit the chat

### Example Interactions

```
CodeOllie [sgm-1] ❯ Create a React component for user authentication
CodeOllie [gpt-4] ❯ /model
CodeOllie [gpt-4-turbo] ❯ Generate a REST API with Express
```

## Configuration

Your config is stored at `~/.codeollie/config.json`:

```json
{
  "activeProvider": {
    "provider": "huggingface",
    "apiKey": "hf_...",
    "model": "sgm-1"
  },
  "providers": {
    "huggingface": {
      "provider": "huggingface",
      "apiKey": "hf_...",
      "model": "sgm-1"
    }
  }
}
```

### Custom Hugging Face Endpoints

For custom Hugging Face spaces, update the config file with your endpoint URL:

```json
{
  "activeProvider": {
    "provider": "huggingface",
    "apiKey": "hf_token",
    "model": "your-model-name",
    "baseUrl": "https://your-username-your-space-name.hf.space/v1"
  }
}
```

## Project Structure

```
src/
├── index.ts      # Entry point & initialization
├── auth.ts       # GitHub OAuth Device Flow authentication
├── providers.ts  # Multi-provider LLM client
├── config.ts     # Config file management
├── fileOps.ts    # File create/edit operations
└── cli.ts        # Interactive CLI interface with slash commands
dist/
└── (compiled JavaScript files)
bin/
└── codeollie.js  # Global CLI entry point
```


## Troubleshooting



### API Key not working
Delete your config and re-run setup:
```bash
rm ~/.codeollie/config.json
codeollie
```


## License

MIT
