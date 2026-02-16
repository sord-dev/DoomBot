import winston from 'winston';
import path from 'path';

// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || 'info';
const nodeEnv = process.env.NODE_ENV || 'development';

// Create logs directory path
const logsDir = process.env.LOGS_DIR || './logs';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaString}`;
  })
);

// Create transports array
const transports: winston.transport[] = [];

// Console transport (always enabled in development)
if (nodeEnv === 'development') {
  transports.push(
    new winston.transports.Console({
      level: logLevel,
      format: consoleFormat
    })
  );
} else {
  // Production console with JSON format
  transports.push(
    new winston.transports.Console({
      level: logLevel,
      format: logFormat
    })
  );
}

// File transports (only in production or if logs directory specified)
if (nodeEnv === 'production' || process.env.LOGS_DIR) {
  transports.push(
    // Combined logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      level: logLevel,
      format: logFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports,
  
  // Don't exit on handled exceptions
  exitOnError: false,
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      format: logFormat 
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      format: logFormat 
    })
  ]
});

// Add a stream for external services if needed
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Export specific log functions for convenience
export const log = {
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  verbose: (message: string, meta?: any) => logger.verbose(message, meta)
};

export default logger;