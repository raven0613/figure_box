import { parseGIF, decompressFrames } from 'gifuct-js';

export const gifToSprite = async (gif: any, maxWidth: any, maxHeight: any, maxDuration: any) => {
  let arrayBuffer: any;
  let error: any;
  let frames: any;

  // if the gif is an input file, get the arrayBuffer with FileReader
  if (gif.type) {
    const reader = new FileReader();
    try {
      arrayBuffer = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(gif);
      });
    } catch (err) {
      error = err;
    }
  }
  // else the gif is a URL or a dataUrl, fetch the arrayBuffer
  else {
    try {
      arrayBuffer = await fetch(gif).then(resp => resp.arrayBuffer());
    } catch (err) {
      error = err;
    }
  }

  // Parse and decompress the gif arrayBuffer to frames with the "gifuct-js" library
  if (!error) frames = decompressFrames(parseGIF(arrayBuffer as any), true);
  if (!error && (!frames || !frames.length)) error = 'No_frame_error';
  if (error) {
    console.error(error);
    return { error };
  }

  // Create the needed canvass
  const dataCanvas = document.createElement('canvas');
  const dataCtx = dataCanvas.getContext('2d');
  const frameCanvas = document.createElement('canvas');
  const frameCtx = frameCanvas.getContext('2d');
  const spriteCanvas = document.createElement('canvas');
  const spriteCtx = spriteCanvas.getContext('2d');

  // Get the frames dimensions and delay
  let [width, height] = [frames[0].dims.width, frames[0].dims.height];
  const delay = frames.reduce((acc: any, cur: any) => (acc = !acc ? cur.delay : acc), null);

  // Set the Max duration of the gif if any
  // FIXME handle delay for each frame
  const duration = frames.length * delay;
  maxDuration = maxDuration || duration;
  if (duration > maxDuration) frames.splice(Math.ceil(maxDuration / delay));

  // Set the scale ratio if any
  maxWidth = maxWidth || width;
  maxHeight = maxHeight || height;
  const scale = Math.min(maxWidth / width, maxHeight / height);
  width = width * scale;
  height = height * scale;

  //Set the frame and sprite canvass dimensions
  frameCanvas.width = width;
  frameCanvas.height = height;
  spriteCanvas.width = width * frames.length;
  spriteCanvas.height = height;

  frames.forEach((frame: any, i: any) => {
    // Get the frame imageData from the "frame.patch"
    const frameImageData = dataCtx!.createImageData(frame.dims.width, frame.dims.height);
    frameImageData.data.set(frame.patch);
    dataCanvas.width = frame.dims.width;
    dataCanvas.height = frame.dims.height;
    dataCtx!.putImageData(frameImageData, 0, 0);

    // Draw a frame from the imageData
    if (frame.disposalType === 2) frameCtx!.clearRect(0, 0, width, height);
    frameCtx!.drawImage(
      dataCanvas,
      frame.dims.left * scale,
      frame.dims.top * scale,
      frame.dims.width * scale,
      frame.dims.height * scale
    );

    // Add the frame to the sprite sheet
    spriteCtx!.drawImage(frameCanvas, width * i, 0);
  });

  // Get the sprite sheet dataUrl
  const dataUrl = spriteCanvas.toDataURL();

  // Clean the dom, dispose of the unused canvass
  dataCanvas.remove();
  frameCanvas.remove();
  spriteCanvas.remove();

  return {
    dataUrl,
    frameWidth: width,
    framesLength: frames.length,
    delay,
  };
};
