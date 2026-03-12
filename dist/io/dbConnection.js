import "dotenv/config";
import { createPool } from "mysql2/promise";
let pool = null;
function requireEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Variavel de ambiente obrigatoria nao definida: ${name}`);
    }
    return value;
}
export function getDbPool() {
    if (pool) {
        return pool;
    }
    const port = Number(requireEnv("MYSQL_PORT"));
    if (!Number.isInteger(port) || port <= 0) {
        throw new Error("MYSQL_PORT deve ser um numero inteiro positivo.");
    }
    pool = createPool({
        host: process.env.MYSQL_HOST?.trim() || "127.0.0.1",
        port,
        user: requireEnv("MYSQL_USER"),
        password: requireEnv("MYSQL_PASSWORD"),
        database: requireEnv("MYSQL_DATABASE"),
        connectionLimit: 10,
        waitForConnections: true,
        queueLimit: 0,
        namedPlaceholders: true,
        charset: "utf8mb4",
        timezone: "Z",
    });
    return pool;
}
export async function closeDbPool() {
    if (!pool) {
        return;
    }
    await pool.end();
    pool = null;
}
