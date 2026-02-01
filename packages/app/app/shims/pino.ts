const noop = () => {};

const createLogger = (opts?: any) => {
  const logger: any = {
    trace: noop,
    debug: noop,
    info: noop,
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    fatal: console.error.bind(console),
    silent: noop,
    child: () => createLogger(),
    level: 'silent',
    isLevelEnabled: () => false,
    bindings: () => ({}),
    flush: noop,
    setBindings: noop,
  };
  return logger;
};

// Pino levels object
export const levels = {
  values: {
    fatal: 60,
    error: 50,
    warn: 40,
    info: 30,
    debug: 20,
    trace: 10,
    silent: Infinity,
  },
  labels: {
    10: 'trace',
    20: 'debug',
    30: 'info',
    40: 'warn',
    50: 'error',
    60: 'fatal',
  },
};

// Additional exports that pino provides
export const stdTimeFunctions = {
  epochTime: () => Date.now(),
  unixTime: () => Math.round(Date.now() / 1000),
  nullTime: () => '',
  isoTime: () => new Date().toISOString(),
};

export const symbols = {
  needsMetadataGsym: Symbol('needsMetadata'),
  serializersSym: Symbol('pino.serializers'),
  redactFmtSym: Symbol('pino.redactFmt'),
  streamSym: Symbol('pino.stream'),
  stringifySym: Symbol('pino.stringify'),
  stringifiersSym: Symbol('pino.stringifiers'),
  setLevelSym: Symbol('pino.setLevel'),
  getLevelSym: Symbol('pino.getLevel'),
  levelValSym: Symbol('pino.levelVal'),
};

export const destination = () => ({
  write: noop,
});

export const transport = () => createLogger();

export const multistream = () => ({
  write: noop,
});

export const pino = Object.assign(createLogger, {
  levels,
  stdTimeFunctions,
  symbols,
  destination,
  transport,
  multistream,
});

export default pino;
