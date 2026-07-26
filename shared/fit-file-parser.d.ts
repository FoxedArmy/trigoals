/**
 * `fit-file-parser` ships no types. We only use the constructor and `parse`,
 * so this declares just that surface — the parsed payload is narrowed at the
 * call site in server/utils/parseWorkoutFile.ts.
 */
declare module 'fit-file-parser' {
  interface FitParserOptions {
    force?: boolean
    speedUnit?: 'm/s' | 'km/h' | 'mph'
    lengthUnit?: 'm' | 'km' | 'mi'
    temperatureUnit?: 'celsius' | 'kelvin' | 'fahrenheit'
    elapsedRecordField?: boolean
    mode?: 'cascade' | 'list' | 'both'
  }

  export default class FitParser {
    constructor(options?: FitParserOptions)
    parse(content: Buffer | ArrayBuffer, callback: (error: unknown, data: unknown) => void): void
  }
}
