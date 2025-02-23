# Email Service Application

A robust, scalable email service application built with TypeScript that provides email management, categorization, and automated processing capabilities.

## Architecture Overview

This application follows SOLID principles and employs several design patterns to ensure maintainability, extensibility, and scalability. See [diagram.txt](./diagram.txt) for a detailed architectural visualization.

### Key Design Patterns & Principles

- **Factory Pattern**: Used in EmailServiceFactory and CategoriserFactory to abstract service creation
- **Dependency Inversion**: Components depend on abstractions (interfaces) rather than concrete implementations
- **Single Responsibility**: Each component has one primary responsibility (EmailService, GmailClient, Categoriser, etc.)
- **Open/Closed**: New email providers or categorizers can be added without modifying existing code
- **Interface Segregation**: Clean interfaces (ILogger, etc.) define specific contracts
- **Strategy Pattern**: Different categorization strategies can be plugged in via LLMCategoriser

## Prerequisites

- Node.js (v18 or higher)
- TypeScript
- Gmail API credentials

## Setup & Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd email-service
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
LLM_API_KEY=your_llm_api_key
```

## Running the Application

### Development Mode

Start the daemon:
```bash
npm run daemon:dev
```

Start the webapp:
```bash
npm run webapp:dev
```

### Production Mode

Build the application:
```bash
npm run build
```

Start the daemon:
```bash
npm run daemon:start
```

Start the webapp:
```bash
npm run webapp:start
```

## Project Structure

```
src/
├── EmailService/          # Email service core functionality
│   ├── EmailService.ts   # Main email service implementation
│   ├── EmailServiceFactory.ts
│   └── EmailServiceManager.ts
├── Repository/           # Data access layer
│   └── GmailClient.ts   # Gmail API integration
├── Categoriser/         # Email categorization
│   ├── LLMCategoriser.ts
│   └── CategoriserFactory.ts
├── lib/                 # Shared utilities
│   └── logger/         # Logging infrastructure
└── models/             # Data models
```

## Dependencies

- **Core Dependencies**
  - TypeScript
  - Node.js
  - Gmail API Client
  - LLM Integration

- **Development Dependencies**
  - ESLint
  - Jest
  - ts-node
  - nodemon

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

[./diagram.txt](./diagram.mermaid)

The diagram illustrates:

1. **Component Relationships**: Shows how different parts of the system interact
2. **Design Patterns**: Highlights where patterns like Factory and Strategy are used
3. **SOLID Principles**:
   - Single Responsibility: Each component has one job
   - Open/Closed: New implementations can be added via factories
   - Liskov Substitution: Implementations can be swapped
   - Interface Segregation: Clean interface boundaries
   - Dependency Inversion: High-level modules depend on abstractions

4. **Layered Architecture**:
   - Service Layer (EmailService)
   - Repository Layer (GmailClient)
   - Domain Layer (Models)
   - Infrastructure Layer (Logging)

This architecture ensures:
- Easy testing through dependency injection
- Simple addition of new email providers or categorizers
- Clear separation of concerns
- Scalability through modular design
