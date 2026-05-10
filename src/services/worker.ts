self.onmessage = function () {
  setInterval(() => {
    self.postMessage(100);
  }, 100);
};

export { };
