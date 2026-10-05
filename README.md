# Inventory Management Application

A web-based inventory and sales management application with a mobile-friendly
interface and a server API backed by a document database.

## Overview

The application provides:

- Inventory and stock movement tracking
- Sales recording with multiple line items
- Customer records and purchase totals
- Dashboard statistics and recent activity
- Protected administrative actions
- Development-time client and server startup scripts

## Project structure

```text
client/       Frontend application
server/       API, authentication, database access, and business services
start-dev.js  Starts the client and server development processes
```

## Requirements

- A current JavaScript runtime
- npm
- A document-database deployment available to the server

## Configuration

Runtime configuration must be supplied through environment variables or a
deployment secret manager. Do not commit `.env` files, credentials, tokens,
private keys, database connection strings, or production configuration.

Required server settings should include:

```text
MONGODB_URI=<private database connection string>
DB_NAME=<database name>
PORT=<server port>
ADMIN_USERNAME=<administrator username>
ADMIN_PASSWORD=<strong administrator password>
JWT_SECRET=<long random signing secret>
FRONTEND_ORIGIN=<allowed frontend origin>
```

Use strong, unique values in every environment. Keep production secrets out of
source control and rotate them immediately if they are exposed. The server
intentionally refuses to start when the database URI, database name, admin
username, admin password, or JWT secret is missing.

## Installation

Install dependencies for the client and server:

```bash
npm install --prefix client
npm install --prefix server
```

## Development

Start both development processes:

```bash
npm run dev
```

Or start them independently:

```bash
npm run dev:client
npm run dev:server
```

## Production build

Build the frontend:

```bash
npm run build
```

Start the server with production configuration:

```bash
npm start --prefix server
```

## Security and data handling

- Never commit secrets or environment files.
- Use least-privilege database credentials.
- Restrict database network access to trusted deployments.
- Use HTTPS for deployed environments.
- Rotate credentials after any suspected exposure.
- Review logs and deployment artifacts before publishing the repository.

## Maintenance

Before opening a pull request:

1. Review the diff for secrets and private configuration.
2. Confirm generated files and local environment files are ignored.
3. Install dependencies from lockfiles.
4. Run the frontend build.
5. Run the server type-check and relevant tests.
6. Rotate any credential that has ever appeared in repository history.
