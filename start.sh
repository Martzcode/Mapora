#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Color definitions for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Resolve absolute path to the project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}"

# ASCII Art header
show_banner() {
    echo -e "${CYAN}${BOLD}"
    echo "  __  __                                "
    echo " |  \/  | __ _ _ __   ___  _ __  __ _   "
    echo " | |\/| |/ _\` | '_ \ / _ \| '_ \/ _\` |  "
    echo " | |  | | (_| | |_) | (_) | | | | (_| |  "
    echo " |_|  |_|\__,_| .__/ \___/|_| |_|\__,_|  "
    echo "              |_|                       "
    echo -e "${NC}"
    echo -e "${BOLD}Mapora Offline Map Application - Runner & Automator${NC}"
    echo "=================================================="
}

log_info() {
    echo -e "${CYAN}${BOLD}[Mapora]${NC} $1"
}

log_success() {
    echo -e "${GREEN}${BOLD}[Success]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}${BOLD}[Warning]${NC} $1"
}

log_error() {
    echo -e "${RED}${BOLD}[Error]${NC} $1"
}

# Display command usage help
show_help() {
    show_banner
    echo "Usage: ./start.sh [command]"
    echo ""
    echo "Commands:"
    echo "  dev       Start both Quarkus backend and Angular/Tauri frontend in dev mode (Default)"
    echo "  backend   Start only the Quarkus backend in dev mode"
    echo "  frontend  Start only the Angular/Tauri frontend in dev mode"
    echo "  install   Check prerequisites and install frontend dependencies"
    echo "  build     Build both backend and frontend for production"
    echo "  help      Show this help documentation"
    echo ""
}

# Check system tool pre-requisites
check_prerequisites() {
    log_info "Checking system prerequisites..."
    
    # Check Java
    if ! command -v java &> /dev/null; then
        log_error "Java is not installed. Mapora backend requires Java 21+."
        exit 1
    fi
    JAVA_VER=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 || echo "unknown")
    log_success "Found Java version: ${JAVA_VER}"

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Mapora frontend requires Node.js 22+."
        exit 1
    fi
    NODE_VER=$(node -v)
    log_success "Found Node.js version: ${NODE_VER}"

    # Check Cargo (Rust compiler package manager)
    if ! command -v cargo &> /dev/null; then
        log_warning "Rust / Cargo is not installed. You will not be able to build/run the Tauri desktop app."
        log_warning "Install Rust using: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    else
        CARGO_VER=$(cargo --version)
        log_success "Found Rust/Cargo: ${CARGO_VER}"
    fi
}

# Install npm packages in the frontend subdirectory if they don't exist
install_dependencies() {
    if [ ! -d "frontend/node_modules" ]; then
        log_info "node_modules directory not found in frontend/. Installing npm packages..."
        cd "${SCRIPT_DIR}/frontend"
        npm install
        cd "${SCRIPT_DIR}"
        log_success "Frontend packages installed successfully."
    else
        log_info "Frontend dependencies are already installed."
    fi
}

# Graceful cleanup handler for background processes
cleanup() {
    # Suppress further traps to avoid loop
    trap - SIGINT SIGTERM EXIT
    echo ""
    log_info "Received stop signal. Stopping all processes..."
    
    # Send SIGTERM to the process group (0 kills the current process group)
    kill 0 2>/dev/null || true
    
    log_success "All services stopped successfully."
    exit 0
}

# Run the Quarkus backend service
run_backend() {
    log_info "Launching Quarkus backend (dev mode)..."
    cd "${SCRIPT_DIR}/backend"
    
    # Make sure mvnw is executable
    if [ -f "./mvnw" ]; then
        chmod +x ./mvnw
        ./mvnw quarkus:dev 2>&1 | awk -v green="${GREEN}" -v nc="${NC}" '{print green "[Backend] " nc $0}' &
    else
        log_warning "mvnw wrapper not found or not executable. Falling back to local 'mvn'."
        mvn quarkus:dev 2>&1 | awk -v green="${GREEN}" -v nc="${NC}" '{print green "[Backend] " nc $0}' &
    fi
    
    cd "${SCRIPT_DIR}"
}

# Run the Angular + Tauri frontend app
run_frontend() {
    log_info "Launching Angular/Tauri frontend (dev mode)..."
    cd "${SCRIPT_DIR}/frontend"
    
    npm run tauri dev 2>&1 | awk -v blue="${BLUE}" -v nc="${NC}" '{print blue "[Frontend] " nc $0}' &
    
    cd "${SCRIPT_DIR}"
}

# Main script logic
COMMAND=${1:-dev}

case "$COMMAND" in
    dev)
        show_banner
        check_prerequisites
        install_dependencies
        
        # Setup exit trap to clean up backend/frontend processes on Ctrl+C
        trap cleanup SIGINT SIGTERM EXIT
        
        run_backend
        # Give backend a moment to initialize ports before running frontend
        sleep 2
        run_frontend
        
        log_info "Mapora is starting up. Press Ctrl+C to terminate both servers."
        
        # Wait for all background tasks
        wait
        ;;
        
    backend)
        show_banner
        check_prerequisites
        trap cleanup SIGINT SIGTERM EXIT
        run_backend
        log_info "Quarkus backend started. Press Ctrl+C to stop."
        wait
        ;;
        
    frontend)
        show_banner
        check_prerequisites
        install_dependencies
        trap cleanup SIGINT SIGTERM EXIT
        run_frontend
        log_info "Tauri frontend started. Press Ctrl+C to stop."
        wait
        ;;
        
    install)
        show_banner
        check_prerequisites
        install_dependencies
        log_success "All setups and dependency installations are completed."
        ;;
        
    build)
        show_banner
        check_prerequisites
        
        log_info "Building Quarkus Backend (generating production JAR)..."
        cd "${SCRIPT_DIR}/backend"
        if [ -f "./mvnw" ]; then
            chmod +x ./mvnw
            ./mvnw clean package
        else
            mvn clean package
        fi
        
        log_info "Building Frontend (generating Tauri production bundle)..."
        cd "${SCRIPT_DIR}/frontend"
        npm install
        npm run tauri build
        
        cd "${SCRIPT_DIR}"
        log_success "Production build completed!"
        log_info "Release bundles can be found in: frontend/src-tauri/target/release/bundle/"
        ;;
        
    help|--help|-h)
        show_help
        ;;
        
    *)
        log_error "Unknown command: ${COMMAND}"
        show_help
        exit 1
        ;;
esac
