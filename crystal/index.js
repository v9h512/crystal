import {Client,GatewayIntentBits,ActionRowBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder} from "discord.js";
import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import {v4 as uuid} from "uuid";
import {createInvoice} from "./utils/invoice.js";
import {createCrypto} from "./utils/crypto.js";

dotenv.config();

const app=express();
app.use(express.json());
app.use(express.static("public"));

app.get("/",(req,res)=>res.send("Crystal Store Online"));

const products=JSON.parse(fs.readFileSync("./products.json"));

const client=new Client({
 intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]
});

app.listen(process.env.PORT||20180);

client.on("ready",async()=>{
 const ch=await client.channels.fetch(process.env.PANEL_CHANNEL);
 const row=new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("open").setLabel("Open Ticket").setEmoji("🎫").setStyle(ButtonStyle.Primary)
 );
 ch.send({embeds:[new EmbedBuilder().setTitle("Crystal Store").setDescription("اضغط لفتح تكت")],components:[row]});
});

client.on("interactionCreate",async i=>{
 if(!i.isButton())return;

 if(i.customId==="open"){
  const t=await i.guild.channels.create({name:`ticket-${i.user.username}`,parent:process.env.TICKET_CATEGORY});
  const row=new ActionRowBuilder();
  products.forEach(p=>row.addComponents(new ButtonBuilder().setCustomId(`prod_${p.id}`).setLabel(p.name).setEmoji(p.emoji).setStyle(ButtonStyle.Secondary)));
  t.send(`👋 مرحبًا ${i.user}\nاختر المنتج`,{components:[row]});
  i.reply({content:"تم فتح التكت",ephemeral:true});
 }

 if(i.customId.startsWith("prod_")){
  const prod=products.find(x=>`prod_${x.id}`===i.customId);
  const row=new ActionRowBuilder().addComponents(
   new ButtonBuilder().setCustomId(`crypto_${prod.id}`).setLabel("Crypto").setEmoji("🪙").setStyle(ButtonStyle.Success),
   new ButtonBuilder().setLabel("Stripe").setURL(prod.stripe).setStyle(ButtonStyle.Link)
  );
  i.channel.send(`اختر الدفع لـ ${prod.name}`,{components:[row]});
 }

 if(i.customId.startsWith("crypto_")){
  const id=i.customId.split("_")[1];
  const prod=products.find(p=>p.id===id);
  const order=uuid();
  const pay=await createCrypto(prod.price,order,process.env);
  i.channel.send(`ادفع هنا:\n${pay.result.url}`);
 }
});

client.on("messageCreate",async m=>{
 if(m.content==="+dn" && m.channel.name.startsWith("ticket")){
  const file=`./invoices/${uuid()}.pdf`;
  createInvoice({buyer:m.channel.name,store:"Crystal Store",status:"Paid"},file);
  await m.channel.send({files:[file]});
  const log=await client.channels.fetch(process.env.LOG_CHANNEL);
  log.send(`عملية جديدة\n${m.channel.name}`);
  m.channel.delete();
 }
});

client.login(process.env.DISCORD_TOKEN);