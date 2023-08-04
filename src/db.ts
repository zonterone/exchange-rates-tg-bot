import { JsonDB, Config } from 'node-json-db'
import * as path from 'path'

export const db = new JsonDB(
	new Config(path.resolve(__dirname, 'db/db'), true, true, '/')
)
