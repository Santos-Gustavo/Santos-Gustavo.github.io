function failOnConsoleErrors(page) {
  page.on("console", msg => {
    if (msg.type() === "error") {
      throw new Error(`Browser console error: ${msg.text()}`);
    }
  });

  page.on("pageerror", error => {
    throw new Error(`Browser page error: ${error.message}`);
  });
}

module.exports = {
  failOnConsoleErrors
};