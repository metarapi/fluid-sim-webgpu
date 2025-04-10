# Fluid Simulation with WebGPU

This project is a browser-based fluid simulation using WebGPU. It supports both particle-based and grid-based rendering modes. While it's functional and visually interesting, it's not fully optimized and performance will vary depending on your GPU and browser.

## Features

- **WebGPU Compute**: Uses WebGPU to run simulation steps on the GPU.
- **Two Rendering Modes**: Switch between particle-based and grid-based visualization.
- **Dynamic Configuration**: Adjust grid size and particle count in real time.
- **Interactive Controls**: Start, pause, step the simulation, and toggle rendering modes.
- **Prefix Sum & PCG Solver**: Implements a basic prefix sum and pressure solver for fluid dynamics.

## Tech Stack

This project uses:

- [TailwindCSS](https://tailwindcss.com) for styling
- [Vite](https://vitejs.dev) for bundling and development
- [Node.js](https://nodejs.org) as a runtime environment
- [`vite-plugin-glsl`](https://www.npmjs.com/package/vite-plugin-glsl) to load `.wgsl` shader files
- [Bootstrap Icons](https://icons.getbootstrap.com) for user interface icons
- [flyonui](https://flyonui.com/), used solely for custom scrollbar styling

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

3. Use the interface to adjust parameters like grid size and particle count, and to switch between rendering modes.

## Project Structure

* `src/js/simulation`: Core simulation logic, buffer initialization, and compute steps.
* `src/js/renderer`: Handles visual output for particles and grids.
* `src/js/config.js`: Simulation configuration generator.
* `src/main.js`: Application entry point.
* `src/server.js`: Simple local server.
* `vite.config.js`: Configuration for Vite.

## Configuration

Simulation parameters can be modified in the `createConfig` function inside `src/js/config.js`. Key parameters include:

* `gridSizeX`, `gridSizeY`: Grid resolution.
* `lengthX`, `lengthY`: World size.
* `particleCount`: Total number of particles.
* `pushApartSteps`: Number of separation steps between particles.

## Controls

* **Start/Pause**: Starts or pauses the simulation loop.
* **Step**: Runs a single simulation step.
* **Switch Renderer**: Toggles between grid and particle rendering.

## Building for Production

To generate a production build:

```bash
npm run build
```

The optimized output will be in the `dist` directory.

## Acknowledgments

This project builds upon the work and inspiration from several individuals:

* **Sebastian Lague** — for his inspiring fluid simulation videos
* **Matthias Müller** — for his PIC/FLIP research and tutorials (https://github.com/matthias-research/pages/tree/master/tenMinutePhysics)
* **Rama C. Hoetzlein** — for GPU sorting logic used as a reference (https://github.com/ramakarl/fluids3)
* **Emmanuel Roche** — for his WGSL prefix sum implementations and examples (https://github.com/roche-emmanuel/nervland_adventures)
* **Robert Bridson** — for *Fluid Simulation for Computer Graphics*, which provided detailed theoretical background

## Troubleshooting

* Ensure your browser supports WebGPU (Chrome Canary or recent versions of Chromium-based browsers).
* Check the developer console for error messages.
* Make sure all dependencies are installed correctly.

If you're stuck, feel free to open an issue in the repository.

## License

This project is licensed under the MIT License. See the `LICENSE` file for more information.
