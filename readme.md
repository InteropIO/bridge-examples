# io.Bridge Examples

This repository contains examples demonstrating various io.Bridge deployment scenarios and integrations.

## Examples

### [Office Integration](./office/readme.md)

Send emails via Outlook from a web app using io.Bridge to connect browser and desktop components.

**Demonstrates:**
- Local io.Bridge setup using `@interopio/bridge`
- Desktop gateway with `@interopio/gateway-server`
- Browser platform with `@interopio/browser-platform`
- Named pipe discovery for Outlook component
- Interop method invocation across browser/desktop boundary
- (Optional) SSO authentication with OAuth2/OIDC

**Key Features:**
- Browser-based email composition
- Native Outlook integration
- Real-time interop communication
- Production-ready authentication patterns

## Deployment Examples

### Docker

- [Docker Compose](./docker/readme.md)
  - [Single Node](./docker/docker-compose/single-node/readme.md)
  - [Cluster with Load Balancing](./docker/docker-compose/cluster/readme.md)

### Kubernetes

- [Kubernetes Deployment](./kubernetes/readme.md)

## Getting Started

Each example contains its own README with detailed setup instructions. Choose the example that best fits your use case:

- **Learning io.Bridge basics?** → Start with [Office Integration](./office/readme.md)
- **Deploying to production?** → See [Docker](./docker/readme.md) or [Kubernetes](./kubernetes/readme.md)

## Prerequisites

- io.Bridge license key
- Node.js 22+ (for local examples)
- Docker (for containerized examples)
- Kubernetes cluster (for K8s examples)

## License

[Add license information]
