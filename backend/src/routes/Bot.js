const router = require("express").Router();
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const QRCode = require("qrcode");
const Bot = require("../model/Bot");
const Oracle = require("../model/Oracle");
const PoolContact = require("../model/PoolContact");
const axios = require("axios");
const PageModel = require("../model/Page");
const poolContact = new PoolContact();
let client; 
let bot;
let isClientReady = false;

async function resetClient() {
  if (client) {
    console.log(`Finalizando instância do cliente ${client.authStrategy?.clientId}...`);
    try {
      await client.destroy(); 
    } catch (error) {
      console.error("Erro ao destruir o cliente:", error);
    }
  }
  client = null;
  isClientReady = false; 
  console.log("Cliente finalizado e pronto para uma nova inicialização.");
}

router.get("/init", async (req, res) => {
  const bot_name = "zapmed";
  bot = new Bot(bot_name, new Oracle(`http://localhost:${process.env.MIDDLEWARE_PORT}`));
  await bot.loadPage(bot_name);
  console.log("nome do bot:", bot_name);
  res.send({ bot: { name: bot.name, page: bot.page } });
  console.log("nome do bot dps do send:", bot.name);
});

router.get("/qrcode/:bot_name", async (req, res) => {
  const bot_name = req.params.bot_name;
  console.log("nome do bot qr:", bot_name, req.params.bot_name);
  if (isClientReady) {
    console.log("Cliente já está pronto. Operação de inicialização não necessária.");
    return res.status(400).send({ error: "Cliente já está pronto." });
  }

  try {
    await resetClient(); // cliente anterior foi finalizado
    client = new Client({
      authStrategy: new LocalAuth({ clientId: bot_name }),
      puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] }
    });

    client.once("qr", async (qr) => {
      try {
        const base64Qr = await QRCode.toDataURL(qr);
        if (!isClientReady) { 
          res.send({ qrcode: base64Qr, name: bot_name });
        }
      } catch (error) {
        console.error("Erro ao gerar o QR code em Base64:", error);
        if (!isClientReady) {
          return res.status(500).send({ error: "Erro ao gerar o QR code" });
        }
      }
    });

    client.once("ready", () => {
      console.log("Pode usar!");
      isClientReady = true; 
    });

    client.on("authenticated", () => {
      console.log(`Bot ${bot_name} autenticado`);
    });

    client.on("disconnected", async (reason) => {
      console.log("Cliente desconectado:", reason);
      await resetClient(); 
    });

    await client.initialize(); 
    start(client);
  } catch (error) {
    console.error("Erro ao inicializar o cliente:", error);
    if (!isClientReady) { 
      return res.status(500).send({ error: "Erro ao inicializar o cliente" });
    }
  }
});

function start(client) {
  client.on("message", async (message) => {
    console.log(`Mensagem recebida de ${message.from}: ${message.body}`);

    const allowedNumbers = [
      "558481671849@c.us",
      "558496914722@c.us",
      "558496245247@c.us",
      "558496531316@c.us",
      "558496345257@c.us",
      "558499076778@c.us",
      "558481553418@c.us",
      "558497041665@c.us",

    ];

    if (allowedNumbers.includes(message.from) && !message.from.includes("@g.us")) {
      const from = message.from;
      const text = message.body.toLowerCase();
      const name = message._data.notifyName;

      let contact = poolContact.isContact(from)
        ? await poolContact.getContact(from)
        : await poolContact.newContact(name, from);

      await bot.receive(contact, text);

      const pendingToDelivery = contact.getPendingToDelivery();

      const mimeExtensionMap = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'audio/ogg': 'ogg',    
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'video/mp4': 'mp4',
      };
      
      for (const element of pendingToDelivery) {
        if (element.media) {
          for (const media of element.media) {
            const extension = mimeExtensionMap[media.mimeType] || 'bin';
            const fileName = `file.${extension}`;
            const messageMedia = new MessageMedia(media.mimeType, media.data, fileName);
      
            // Configura as opções de envio
            const options = {};
            if (media.mimeType === 'video/mp4' && media.sendAsGif) {
              options.sendVideoAsGif = true;
            }
            // Se for áudio e estiver em OGG, envia como voice note
            if (media.mimeType === 'audio/ogg') {
              options.sendAudioAsVoice = true;
            }
            await client.sendMessage(from, messageMedia, options);
          }
        }
        if (element.text) {
          await client.sendMessage(from, element.text);
        }
      }
    }
  });
}

router.get("/reset", async (req, res) => {
  await resetClient();
  res.send({ message: "Cliente reiniciado com sucesso." });
});



router.put("/message", async (req, res) => {
  let { text, from, name } = req.body;

  let contact;

  if (!poolContact.isContact(from)) {
    contact = await poolContact.newContact(name, from);
  } else {
    contact = await poolContact.getContact(from);
  }

  await bot.receive(contact, text);

  let pendingToDelivery = contact.getPendingToDelivery();
  let txt = pendingToDelivery.map(element => element.text).join("");

  res.send({ from: from, text: txt });
});

//CRIADAS POR MIM
router.get("/listBot", async (req, res) => {
 
   try {
    // Altere para o endereço correto da outra aplicação
    const response = await axios.get("http://localhost:3000/bot_connection/ping");

    if (response.status === 200) {
      console.log(response.data)
      return res.send(response.data) ;
    } else {
      return res.status(500).send({ message: "Aplicação encontrada, mas resposta inesperada." });
    }
  } catch (error) {
    console.error("Erro ao conectar com a outra aplicação:", error.message);
    return res.status(500).send({ message: "Não foi possível reconhecer a outra aplicação." });
  }
});


router.get("/pull-questionnaire/:_key", async (req, res) => {
  try {
    const _key = req.params._key;
    //Monta a URL exata do app que retorna o JSON do Page
    const STATS_BASE_URL = process.env.STATS_APP_URL || "http://localhost:3000";
    const statsEndpoint = `${STATS_BASE_URL}/bot_connection/questionnaire-page/${_key}`;

    //Chama via HTTP GET para obter o JSON “Page”
    const response = await axios.get(statsEndpoint);
    const pageJson = response.data;

    //Valida mínima: se não tiver intro ou _key, dá erro
    if (!pageJson || !pageJson._key || !pageJson.intro) {
      return res.status(400).json({ error: "Resposta da Stats App não é um Page válido." });
    }

    // Instancia o model Page no Bot e atribui a bot.page
    //    Se o Bot ainda não existir ( init não foi chamado), retorna um erro
    if (!bot) {
      return res.status(400).json({ error: "Bot não foi inicializado. Chame /init primeiro." });
    }
    bot.page = new PageModel(pageJson);

    // 5. Retorna o JSON ao (usuario) paciente
    return res.json({
      status: "ok",
      message: `Page '${_key}' carregada com sucesso no Bot.`,
      loadedPage: pageJson
    });
  } catch (error) {
    console.error("Erro em /pull-questionnaire/:_key:", error);
    //Se a outra retornar 404, axios.get dispara erro, então devolvemos 404
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: "Questionário não encontrado na aplicação de Estatísticas." });
    }
    return res.status(500).json({ error: error.message });
  }
});
module.exports = router;
