//+------------------------------------------------------------------+
//|                                             TradeStreakSync.mq5   |
//|  Sincroniza automáticamente el historial de tu cuenta MT5 con     |
//|  TradeStreak. Sólo LEE el historial: nunca abre ni cierra órdenes.|
//+------------------------------------------------------------------+
#property copyright   "TradeStreak"
#property version     "1.00"
#property description "Sincroniza tu historial de operaciones de MT5 con tu diario TradeStreak."
#property description "1) Herramientas > Opciones > Asesores Expertos > Permitir WebRequest para la URL de TradeStreak."
#property description "2) Pega tu token de sincronización (lo encuentras en TradeStreak > Cuentas)."

input string InpServerUrl   = "http://127.0.0.1:4000/api/sync/mt5"; // URL de sincronización
input string InpToken       = "";                                   // Token de sincronización
input int    InpIntervalSec = 60;                                   // Intervalo de sincronización (segundos)
input int    InpBatchSize   = 500;                                  // Deals por envío

datetime g_lastSynced = 0;
bool     g_ready      = false;
string   g_status     = "Iniciando...";

string GvName() { return "TradeStreak_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)); }

//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(InpToken) < 10)
   {
      Alert("TradeStreak: pega tu token de sincronización en los parámetros del EA.");
      return INIT_PARAMETERS_INCORRECT;
   }
   if(MQLInfoInteger(MQL_TESTER))
   {
      Print("TradeStreak: el EA no sincroniza en el probador de estrategias.");
      return INIT_SUCCEEDED;
   }
   EventSetTimer(MathMax(10, InpIntervalSec));
   g_ready = Handshake();
   if(g_ready) SyncNow();
   ShowStatus();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment("");
}

void OnTimer()
{
   if(!g_ready) g_ready = Handshake();
   if(g_ready) SyncNow();
   ShowStatus();
}

// Se dispara cuando se ejecuta un nuevo deal: sincronizamos al instante.
void OnTradeTransaction(const MqlTradeTransaction &trans, const MqlTradeRequest &request, const MqlTradeResult &result)
{
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD && g_ready)
   {
      SyncNow();
      ShowStatus();
   }
}

//+------------------------------------------------------------------+
//| Pregunta al servidor cuál es el último deal que ya tiene          |
//+------------------------------------------------------------------+
bool Handshake()
{
   char   data[];
   string response;
   int code = Request("GET", data, response);
   if(code != 200) return false;

   long serverLast = JsonGetLong(response, "last_deal_time");
   long localLast  = GlobalVariableCheck(GvName()) ? (long)GlobalVariableGet(GvName()) : 0;
   // Si el servidor no tiene nada (cuenta nueva o reiniciada) enviamos todo el historial.
   g_lastSynced = (datetime)MathMin(serverLast, localLast > 0 ? localLast : serverLast);
   PrintFormat("TradeStreak: conectado. Sincronizando desde %s", g_lastSynced > 0 ? TimeToString(g_lastSynced) : "el inicio");
   return true;
}

//+------------------------------------------------------------------+
//| Envía los deals nuevos (con 1 día de solapamiento; el servidor    |
//| ignora duplicados) junto con el balance y equity actuales.        |
//+------------------------------------------------------------------+
bool SyncNow()
{
   datetime from = g_lastSynced > 86400 ? g_lastSynced - 86400 : 0;
   if(!HistorySelect(from, TimeCurrent() + 86400))
   {
      g_status = "Error leyendo el historial";
      return false;
   }

   int      total   = HistoryDealsTotal();
   datetime maxTime = g_lastSynced;
   string   account = AccountJson();
   int      i = 0, sent = 0;

   do
   {
      string deals = "";
      int n = 0;
      for(; i < total && n < InpBatchSize; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket == 0) continue;
         if(n > 0) deals += ",";
         deals += DealJson(ticket);
         n++;
         datetime t = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
         if(t > maxTime) maxTime = t;
      }

      string body = "{\"account\":" + account + ",\"deals\":[" + deals + "]}";
      char   data[];
      int len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
      ArrayResize(data, MathMax(0, len - 1)); // quitar el terminador nulo
      string response;
      int code = Request("POST", data, response);
      if(code != 200)
      {
         if(code == 401 || code == 409) g_ready = false;
         return false;
      }
      sent += n;
   }
   while(i < total);

   g_lastSynced = maxTime;
   GlobalVariableSet(GvName(), (double)g_lastSynced);
   g_status = StringFormat("Sincronizado %s (%d deals revisados)", TimeToString(TimeLocal(), TIME_DATE | TIME_SECONDS), sent);
   return true;
}

//+------------------------------------------------------------------+
int Request(const string method, char &data[], string &response)
{
   char   result[];
   string resultHeaders;
   string headers = "Content-Type: application/json\r\nX-Sync-Token: " + InpToken + "\r\n";

   ResetLastError();
   int code = WebRequest(method, InpServerUrl, headers, 15000, data, result, resultHeaders);
   if(code == -1)
   {
      int err = GetLastError();
      if(err == 4014)
         g_status = "Permite la URL en Herramientas > Opciones > Asesores Expertos > WebRequest";
      else
         g_status = StringFormat("No se pudo conectar con TradeStreak (error %d)", err);
      Print("TradeStreak: ", g_status, " URL: ", InpServerUrl);
      return -1;
   }
   response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(code != 200)
   {
      g_status = StringFormat("El servidor respondió %d: %s", code, response);
      Print("TradeStreak: ", g_status);
   }
   return code;
}

//+------------------------------------------------------------------+
string AccountJson()
{
   return "{\"login\":" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) +
          ",\"server\":\"" + JsonEscape(AccountInfoString(ACCOUNT_SERVER)) + "\"" +
          ",\"company\":\"" + JsonEscape(AccountInfoString(ACCOUNT_COMPANY)) + "\"" +
          ",\"currency\":\"" + JsonEscape(AccountInfoString(ACCOUNT_CURRENCY)) + "\"" +
          ",\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) +
          ",\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + "}";
}

string DealJson(const ulong ticket)
{
   return "{\"ticket\":" + (string)ticket +
          ",\"order\":" + (string)HistoryDealGetInteger(ticket, DEAL_ORDER) +
          ",\"position_id\":" + (string)HistoryDealGetInteger(ticket, DEAL_POSITION_ID) +
          ",\"time\":" + (string)(long)HistoryDealGetInteger(ticket, DEAL_TIME) +
          ",\"type\":" + (string)HistoryDealGetInteger(ticket, DEAL_TYPE) +
          ",\"entry\":" + (string)HistoryDealGetInteger(ticket, DEAL_ENTRY) +
          ",\"symbol\":\"" + JsonEscape(HistoryDealGetString(ticket, DEAL_SYMBOL)) + "\"" +
          ",\"volume\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_VOLUME), 4) +
          ",\"price\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_PRICE), 8) +
          ",\"sl\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_SL), 8) +
          ",\"tp\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_TP), 8) +
          ",\"profit\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_PROFIT), 2) +
          ",\"commission\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_COMMISSION), 2) +
          ",\"swap\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_SWAP), 2) +
          ",\"fee\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_FEE), 2) +
          ",\"magic\":" + (string)HistoryDealGetInteger(ticket, DEAL_MAGIC) +
          ",\"comment\":\"" + JsonEscape(HistoryDealGetString(ticket, DEAL_COMMENT)) + "\"}";
}

string JsonEscape(string s)
{
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   StringReplace(s, "\r", " ");
   StringReplace(s, "\n", " ");
   StringReplace(s, "\t", " ");
   return s;
}

// Lector mínimo de un número en un JSON plano: "clave":123
long JsonGetLong(const string json, const string key)
{
   int pos = StringFind(json, "\"" + key + "\"");
   if(pos < 0) return 0;
   pos = StringFind(json, ":", pos);
   if(pos < 0) return 0;
   int end = pos + 1;
   while(end < StringLen(json))
   {
      ushort c = StringGetCharacter(json, end);
      if(c == ',' || c == '}') break;
      end++;
   }
   return StringToInteger(StringSubstr(json, pos + 1, end - pos - 1));
}

void ShowStatus()
{
   Comment("TradeStreak Sync\n", g_status);
}
//+------------------------------------------------------------------+
