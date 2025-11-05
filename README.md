# Fluid Simulation with WebGPU

This project is a browser-based fluid simulation using WebGPU. It supports both particle-based and grid-based rendering modes. While it's functional and visually interesting, it's not fully optimized and performance will vary depending on your GPU and browser. [Try it here.](https://metarapi.github.io/fluid-sim-webgpu/)

## Features

- **WebGPU Compute**: Uses WebGPU to run simulation steps on the GPU.
- **Two Rendering Modes**: Switch between particle-based and grid-based visualization.
- **Dynamic Configuration**: Adjust grid size and particle count in real time.
- **Interactive Controls**: Start, pause, step the simulation, and toggle rendering modes.
- **Prefix Sum & PCG Solver**: Implements a high-performance, single-pass inclusive prefix sum (scan) using the CSDLDF algorithm with WebGPU subgroups, and a pressure solver for fluid dynamics.
- **Multi-layered Volume Conservation**: Combines implicit density projection with divergence-free velocity fields and particle push-apart for robust volume preservation.
- **Jittered Particle Distribution**: Uses PCG2D hash function to create natural-looking particle distributions.

## Tech Stack

This project uses:

- [TailwindCSS](https://tailwindcss.com) for styling
- [Vite](https://vitejs.dev) for bundling and development
- [Node.js](https://nodejs.org) as a runtime environment
- [`vite-plugin-glsl`](https://www.npmjs.com/package/vite-plugin-glsl) to load `.wgsl` shader files
- [Bootstrap Icons](https://icons.getbootstrap.com) for user interface icons
- [flyonui](https://flyonui.com/), used solely for custom scrollbar styling

**WebGPU Requirements:**
- Requires a browser and GPU supporting the `subgroups` feature (used for the single-pass prefix sum/scan). Most modern discrete GPUs and recent Chromium-based browsers support this, but some integrated GPUs or older drivers may not.

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

## Volume Conservation

This simulation employs a comprehensive multi-layered approach to volume conservation:

### Implicit Density Projection
The simulation implements the method described in "Implicit Density Projection for Volume Conserving Liquids" (Kugelstadt et al., 2019), which:

- Calculates density deviations from target density
- Solves a separate pressure equation specifically for density deviations
- Directly applies position corrections to particles
- Preserves volume even in long-running simulations

### Density-Adapted Pressure Projection
The standard pressure solve incorporates density in two ways:

1. **Divergence Source Term**: The divergence calculation includes a density correction term that helps counteract over-dense regions by modifying the right-hand side of the pressure equation.
   
2. **Pressure Application**: Velocity updates from pressure gradients are scaled inversely by local density, making pressure forces adaptive to density variations.

These modifications to the traditional pressure solve help maintain proper incompressibility throughout the fluid.

### Particle Push-Apart Method
Inspired by Matthias Müller's work the simulation also employs a direct particle separation approach that:

- Directly updates particle positions to maintain a minimum separation and prevent overlap (no forces are used).
- Uses PCG2D hash-based jittering to break symmetry, preventing particles from collapsing into the same point or forming artificial grid patterns.
- Gradually reduces the magnitude of position corrections over multiple substeps for stable convergence.
- Includes a simple velocity averaging step between neighbors (intended as a basic non-physical approximation of viscous dissipation)
- Provides microscopic incompressibility, complementing the macroscopic pressure solvers.
- Resolves degenerate configurations (such as particle stacking or collapse) that pressure-based methods alone might miss.

These complementary approaches work together to maintain volume conservation at multiple scales - from the microscopic particle level to the macroscopic fluid volume.

## Controls

* **Start/Pause**: Starts or pauses the simulation loop.
* **Step**: Runs a single simulation step.
* **Reset**: Resets the simulation. 
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
* **Mark Jarzynski and Marc Olano** — for their PCG2D hash function used to add jitter to the particles ([*Hash Functions for GPU Rendering, Journal of Computer Graphics Techniques (JCGT)*, vol. 9, no. 3, 20–38, 2020](https://www.jcgt.org/published/0009/03/02/paper.pdf))
* **Tassilo Kugelstadt, Andreas Longva, Nils Thuerey, Jan Bender** - for their implicit density projection ([*Implicit Density Projection for Volume Conserving Liquids, IEEE Transactions on Visualization and Computer Graphics (2019)*](https://ieeexplore.ieee.org/document/8869736))
* **Thomas Smith, John D. Owens, Raph Levien** - for their prefix sum shader. ([*Decoupled Fallback: A Portable Single-Pass GPU Scan*](https://doi.org/10.1145/3694906.3743326))

## Troubleshooting

- Ensure your browser supports WebGPU **with the `subgroups` feature** (see browser and GPU requirements above).
- Check the developer console for error messages.
- Make sure all dependencies are installed correctly.

If you're stuck, feel free to open an issue in the repository.

## License

This project is licensed under the MIT License. See the `LICENSE` file for more information.
