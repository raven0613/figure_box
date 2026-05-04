self.onmessage = function (e) {
  setInterval(() => {
    self.postMessage(100);
  }, 100);
};

export {};
