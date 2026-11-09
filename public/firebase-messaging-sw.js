// Compatibilidade: o /sw.js publicado antes desta versão faz importScripts deste arquivo. Ele passa a carregar os
// handlers de Web Push (sem Firebase) até o navegador instalar o /sw.js novo, que importa push-sw.js direto.
importScripts('/push-sw.js');
