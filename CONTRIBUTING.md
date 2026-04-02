# Contributing to AushadX 🏥

First off, thank you for considering contributing to AushadX! It’s people like you that make this ecosystem great, safe, and accessible to everyone.

## Code of Conduct
By participating in this project, you are expected to uphold our standard guidelines of professionalism and respect. Note that any form of harassment will not be tolerated.

## How Can I Contribute?

### Reporting Bugs
If you find a bug, please create an Issue in the repository. Provide as much detail as possible, including:
- Steps to reproduce
- Expected and actual behavior
- Relevant logs from the microservices (e.g., using `kubectl logs`)
- Environment details (e.g. Mobile platform vs Backend)

### Suggesting Enhancements
Have an idea for a new feature? We’d love to hear it! Open an Issue and tag it as an "enhancement". Explain how it would work and why it would be beneficial to AushadX.

### Pull Requests
1. **Fork** the repository and create your feature branch from `main`.
2. **Set up** your local environment following the Getting Started guide in our `README.md` and `k8s/DEPLOYMENT.md`.
3. **Commit** your changes logically. If you’ve added code that should be tested, please add comprehensive unit/integration tests.
4. **Push** your branch to your fork.
5. **Create** a descriptive Pull Request explaining what your code changes, the rationale behind it, and any testing performed.

## Development Ecosystem Notes
When you make changes to the microservices, remember that AushadX relies on synchronized APIs:
- If making changes to the *Profile Manager*, ensure Auth flows and FCM pushes aren't disrupted.
- If altering the *Agent Service* WebSockets, ensure the React Native mobile client payloads parse similarly.

Happy Coding! 🚀
