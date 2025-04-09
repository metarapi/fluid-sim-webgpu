# Fluid Simulation with WebGPU

This project implements a high-performance fluid simulation using WebGPU. It leverages modern GPU compute capabilities to simulate fluid dynamics in real-time, with support for particle-based and grid-based rendering.

## Features

- **WebGPU-based Simulation**: Utilizes WebGPU for high-performance compute operations.
- **Particle and Grid Rendering**: Switch between particle-based and grid-based visualizations.
- **Dynamic Configuration**: Adjust grid size and particle count dynamically.
- **Interactive Controls**: Start, pause, step, and toggle simulation modes.
- **Prefix Sum and PCG Solver**: Implements advanced algorithms for efficient simulation.

## Prerequisites

- **Node.js**
- **WebGPU Support**

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/metarapi/fluid-sim-webgpu.git
   cd fluid-sim-webgpu
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Simulation

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000/
   ```

3. Use the dropdown menus to adjust grid size and particle count dynamically.

## Project Structure

- **`src/js/simulation`**: Core simulation logic, including buffer initialization and simulation steps.
- **`src/js/renderer`**: Rendering logic for particles and grids.
- **`src/js/config.js`**: Configuration generation for the simulation.
- **`src/main.js`**: Entry point for initializing the simulation.
- **`src/server.js`**: Simple HTTP server for serving the application.
- **`vite.config.js`**: Vite configuration for development and build.

## Configuration

You can customize the simulation by modifying the `createConfig` function in `src/js/config.js`. Key parameters include:

- `gridSizeX` and `gridSizeY`: Grid dimensions.
- `lengthX` and `lengthY`: World dimensions.
- `particleCount`: Number of particles in the simulation.
- `pushApartSteps`: Number of steps for particle separation.

## Controls

- **Start/Pause**: Toggle the simulation.
- **Step**: Run a single simulation step.
- **Switch Renderer**: Switch between particle and grid rendering.

## Building for Production

To build the project for production, run:
```bash
npm run build
```

The output will be in the `dist` directory.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgments

- **WebGPU**: For enabling high-performance GPU compute in the browser.
- **TailwindCSS**: For styling the application.
- **Bootstrap Icons**: For UI icons.

## Troubleshooting

If you encounter issues:
- Ensure your browser supports WebGPU.
- Check the console for error messages.
- Verify that all dependencies are installed.

For further assistance, feel free to open an issue on the repository.
