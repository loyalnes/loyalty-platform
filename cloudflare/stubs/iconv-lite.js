// Replaces iconv-lite in the Worker bundle. The real package needs Node streams internals that
// workerd does not provide; body-parser/raw-body only need decoding of request bodies.
function exists(encoding) {
  try {
    new TextDecoder(encoding);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  encodingExists: exists,
  decode(buffer, encoding) {
    return new TextDecoder(encoding || "utf-8").decode(buffer);
  },
  getDecoder(encoding) {
    const decoder = new TextDecoder(encoding || "utf-8");
    return {
      write: (chunk) => decoder.decode(chunk, { stream: true }),
      end: () => decoder.decode(),
    };
  },
};
