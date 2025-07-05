Hand Recognition Finger Brush (HTML-Based)

A browser-only hand recognition application with finger brush functionality and gesture-based controls using MediaPipe Hands JavaScript.

## Features

* **Hand Detection**: Real-time hand landmark detection powered by the MediaPipe Hands JS solution.
* **Finger Brush**: Draw on an HTML `<canvas>` by pointing with your index finger. Both hands are supported; the right hand draws in a default dark blue ink and the left in white (customizable).
* **Gesture Controls**: Activate HTML buttons by hovering your index finger over them for 1.5 seconds, indicated by a radial progress overlay.
* **Color Sampling Mode**: Sample brush color from the live camera feed a short distance ahead of your fingertip each animation frame.
* **Mirrored Full Screen Video**: The camera feed fills the entire browser window and is displayed like a mirror for easier interaction.

### Control Buttons (HTML UI)

Five HTML `<button>` elements sit overlayed at the top center of the canvas:

1. **VID**: Toggle the camera feed visibility behind the drawing canvas.
2. **CLR**: Clear all strokes from the drawing canvas.
3. **COL**: Cycle through a predefined list of brush colors.
4. **THK**: Cycle through a predefined list of brush thicknesses.
5. **SMP**: Toggle sampling mode, where the brush color is taken from the live video at the fingertip offset.

Additionally, two color-picker inputs (`<input type="color">`) on the left and right edges let users choose specific colors for each hand.

## Requirements

* A modern web browser (Chrome, Edge, Safari) with camera access.
* Internet connection to load MediaPipe JS modules (or host them locally).

## Setup

1. Clone or download the repository containing `index.html`, `style.css`, and `app.js`.

2. Ensure the following scripts are included in `index.html`:

   ```html
   <!-- MediaPipe Hands JS -->
   <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
   <!-- Drawing and Camera Utils -->
   <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
   <!-- Your application logic -->
   <script src="app.js"></script>
   ```

3. Open `index.html` in your browser and grant camera permissions when prompted.

## Usage

1. **Drawing**:

   * Point with your index finger (all other fingers curled).
   * Move your finger to draw on the canvas. Drawing stops when over a control button or color picker.
   * Choose specific brush colors for each hand via the color pickers.

2. **Button Activation**:

   * Hover your fingertip over any control button.
   * A circular progress indicator appears around the button edge.
   * After 1.5 seconds, the button’s action triggers.

3. **Color Sampling**:

   * Toggle sampling mode with the **SMP** button.
   * While active, the brush color updates every frame to match the video pixel under an offset from your fingertip.

4. **Clearing & Toggle**:

   * Use **CLR** to reset the canvas.
   * Use **VID** to show/hide the live camera feed.

5. **Exit**:

   * Close the browser tab to end the session.

## How It Works

* **MediaPipe Hands JS**:

  * Instantiate a `Hands` object:

    ```javascript
    const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    });
    ```
  * Listen for `onResults` callbacks to receive `results.multiHandLandmarks` and `results.image`.

* **Canvas Drawing**:

  * Use two stacked `<canvas>` elements: one for video or black background, one for permanent drawing.
  * In each animation frame (`requestAnimationFrame`), draw the video frame (if visible), overlay landmarks, and update strokes.

* **Gesture Detection**:

  * Identify pointing by checking the relative positions of landmarks 8 (index tip) and 6 (index MCP), and ensuring other fingers are folded (landmarks for tips are below their PIP joints).
  * Track hover durations by comparing fingertip coordinates with button bounding boxes and using `performance.now()` for timers.

* **Color Sampling**:

  * Compute a sampling point ahead of the index fingertip using the direction vector between landmarks 8 and 5.
  * Read the pixel color from the video canvas via `getImageData` and set the current brush color.

## References

* MediaPipe Hands JS Quickstart and demos: [https://mediapipe.readthedocs.io/en/latest/solutions/hands.html](https://mediapipe.readthedocs.io/en/latest/solutions/hands.html)
* Examples of integration with HTML Canvas and gesture controls from the MediaPipe documentation

*This plan outlines a fully HTML/JavaScript-based implementation, leveraging MediaPipe Hands for real-time hand tracking without any Python or desktop dependencies.*
