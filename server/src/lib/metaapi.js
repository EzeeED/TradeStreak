// Conector opcional con MetaApi (https://metaapi.cloud), un servicio que mantiene terminales
// MT5 en la nube. Permite que el usuario conecte su cuenta sólo con login, contraseña
// (se recomienda la de "investor"/solo lectura) y servidor, sin instalar nada.
// La contraseña se envía a MetaApi una vez y NUNCA se guarda en TradeStreak.

import crypto from 'node:crypto';
import { config } from '../config.js';

const PROVISIONING = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';
const clientUrl = (region) => `https://mt-client-api-v1.${region || config.metaapi.region}.agiliumtrade.ai`;

export const metaapiEnabled = () => Boolean(config.metaapi.token);

async function call(url, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'auth-token': config.metaapi.token, 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.message || `MetaApi respondió ${res.status}`);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return { status: res.status, data };
}

/** Registra la cuenta en MetaApi. Devuelve el id de cuenta de MetaApi. */
export async function createAccount({ login, password, server, name }) {
  const { status, data } = await call(`${PROVISIONING}/users/current/accounts`, {
    method: 'POST',
    headers: { 'transaction-id': crypto.randomBytes(16).toString('hex') },
    body: {
      login: String(login),
      password,
      server,
      name: name || `TradeStreak ${login}`,
      platform: 'mt5',
      magic: 0,
      region: config.metaapi.region,
      reliability: 'regular',
    },
  });
  if (status === 202 || !data?.id) {
    const err = new Error('MetaApi está buscando la configuración del servidor del broker. Vuelve a intentarlo en un minuto.');
    err.status = 202;
    throw err;
  }
  return data.id;
}

export async function getAccount(id) {
  return (await call(`${PROVISIONING}/users/current/accounts/${id}`)).data;
}

export async function deleteAccount(id) {
  try {
    await call(`${PROVISIONING}/users/current/accounts/${id}`, { method: 'DELETE' });
  } catch (err) {
    if (err.status !== 404) throw err;
  }
}

export async function getAccountInformation(id, region) {
  return (await call(`${clientUrl(region)}/users/current/accounts/${id}/account-information`)).data;
}

/** Descarga todos los deals entre dos fechas, paginando de 1000 en 1000. */
export async function getHistoryDeals(id, region, from, to = new Date()) {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const url = `${clientUrl(region)}/users/current/accounts/${id}/history-deals/time/${from.toISOString()}/${to.toISOString()}?offset=${offset}&limit=1000`;
    const { data } = await call(url);
    const page = Array.isArray(data) ? data : data?.deals ?? [];
    all.push(...page);
    if (page.length < 1000) break;
  }
  return all;
}
