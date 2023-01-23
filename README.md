# Wrapper backup

This CLI tool can be used to download/publish wrappers from/to the wrappers gateway.

### Run with cloning the repo:
1. Clone the repo
2. Run "nvm install && nvm use"
3. Run "yarn" to install dependencies
5. Run "yarn dev {command}" to run the commands with ts-node

### The following commands are supported:
- `download`: download all the wrappers from the wrappers gateway
    - `-t` target directory
    - `-u` (optional) url of the wrappers gateway. Default: https://ipfs.wrappers.io
- `publish`: publish wrappers from a local direct
    - `-t` target directory
    - `-u` (optional) url of the wrappers gateway. Default: https://ipfs.wrappers.io
- `help`: Display help for command