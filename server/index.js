require('dotenv').config();
const express = require("express");
const app = express();
const mysql = require("mysql2");
const cors = require("cors");
const e = require("cors");
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const cron = require('node-cron');


//conectando banco
const db = mysql.createPool({
 host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport(
  {
    secure: true,
    host: 'smtp.gmail.com',
    port: 465,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
  }
)

function sendMail(to, sub, msg) {
  const mailOptions = {
    // from: 'filadobandejao@gmail.com', // Remetente
    to: to,
    subject: sub,
    html: msg
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Erro ao enviar o e-mail', error);
    }
    else {
      console.log('E-mail enviado com sucesso: ', info.response);
    }
  });
}

function verificarHorarioAgendamentos() {
  const agora = new Date();

  db.query("SELECT email, horario FROM agendamento WHERE ativo = 1", (err, result) => {
    if (err) {
      console.log("Erro ao buscar agendamentos: ", err);
      return;
    }

    result.forEach(agendamento => {
      const horarioAgendado = new Date(agendamento.horario);
      const diferenca = horarioAgendado - agora; // Diferença entre o horário agendado e o horário atual
      // Se faltarem 10 minutos (600.000 ms) ou menos, enviaremos o e-mail
      if (diferenca <= 600000 && diferenca >= 0) {
        sendMail(
          agendamento.email, // Enviar para o e-mail do agendamento
          "Lembrete do Agendamento no RU", // Assunto
          "Lembre-se que seu agendamento está chegando! Você tem até 10 minutos para chegar no RU. Não se atrase!" // Corpo do e-mail
        );
        console.log(`E-mail de lembrete enviado para: ${agendamento.email}`);
      }
    })
  })
}
//almoco
cron.schedule('38-58/10 11 * * *', executeCronTask);
cron.schedule('8-58/10 12 * * *', executeCronTask);
cron.schedule('8 13 * * *', executeCronTask);
//janta
cron.schedule('58 16 * * *', executeCronTask);
cron.schedule('8-58/10 17 * * *', executeCronTask);
cron.schedule('8-28/10 18 * * *', executeCronTask);


function executeCronTask() {
  console.log("Verificando agendamentos...");
  verificarHorarioAgendamentos();
};

//BANCO
// criando instancias no banco
app.post("/register", (req, res) => {
  //recebe as infos
  const { email, name } = req.body;
  let insert = "INSERT INTO aluno (email, nome) VALUES (?, ?)"; //string insert

  //VERIFICA SE ALUNO JA ESTA CADASTRADO
  db.query("SELECT * from aluno WHERE email = ?", [email], (err, result) => {
    if (err) {
      //se der erro
      console.error(err);
      return console.log("Deu ruim rapaziada kkk");
    }
    if (result.length > 0) {
      //se o resultado for > 0 significa q ja tem um email cadastrado, logo:
      return console.log("o aluno %s já esta cadastrado", name);
    }
    // Se os resultados anteriores forem falso, ent o email não existe, inseir os dados no banco:
    db.query(insert, [email, name], (err, result) => {
      if (err) {
        console.error(err);
        return console.log("deu ruim dnv manerr ksksksk");
      }

      // Retorna uma resposta de sucesso
      return console.log("Aluno cadastrado com sucesso");
    });
  });
});

//criando agendamento
app.post("/agendar", (req, res) => {
  //pegando parametros
  const { senha, data, hora, email, ativo } = req.body;

  const dataQrCode = email + " " + hora + " " + data;
  const hash = crypto.createHash('sha256').update(dataQrCode).digest('hex');

  let insertAgend =
    "INSERT INTO agendamento (senha, data, horario, email, ativo, idhash) VALUES (?, ?,  ?, ?, ?, ?)"; //string insert

  //verifica se aluno ja tem agendamento
  db.query(
    "SELECT * from agendamento WHERE email = ? AND ativo = 1",
    [email],
    (err, result) => {
      //se der erro
      if (err) {
        console.error(err);
        return console.log("po o mano fez besteiraKKK");
      }
      //se ja tiver agendamento ativo
      if (result.length > 0) {
        return console.log(
          "Este usuario ja possui um agendamento ativo, nao foi possível criar outro agendamento"
        );
      }
      //se poder fazer
      db.query(
        insertAgend,
        [senha, data, hora, email, ativo, hash],
        (err, result) => {
          //se der erro
          if (err) {
            console.error(err);
            return console.log("pai fez besteiraKKK");
          }
          //se der certo
          res.json({
            success: true,
            message: "Agendamento feito com sucesso!!!",
            email: email,
            hash: hash, // Retornando o hash gerado
          });
          sendMail(email, "Lembrete do Agendamento no RU", "Lembre-se que seu agendamento está chegando! Você tem até 10 minutos para chegar no RU. Não se atrase!")
          return console.log("Agendamento feito com sucesso, %s!", email);
        }
      );
    }
  );
});

//cancelando agendamento
app.post("/cancelarAgendamento", (req, res) => {
  res.send("Requisição recebida com sucesso");

  //pegando parametros
  const { email } = req.body;
  let DeleteAgend = "UPDATE agendamento SET ativo = FALSE WHERE email = ?"; //string insert

  //cancela agendamento do aluno
  db.query(DeleteAgend, [email], (err, result) => {
    //se der erro
    if (err) {
      console.error(err);
      return console.log("pai fez besteiraKKK");
    }
    //se der certo
    return console.log("Agendamento cancelado com sucesso, %s!", email);
  });
});

//verifica se aluno ja possui agendamento
app.get("/verificarAgendamento", (req, res) => {
  console.log("Verificando se possui agendamento Ativo");
  const { emailUsuario } = req.query;
  const query =
    "SELECT senha, data, horario, email, idhash FROM agendamento WHERE email = ? AND ativo = true;";

  db.query(query, [emailUsuario], (err, result) => {
    if (err) {
      res.status(500).send("Erro ao realizar a consulta");
      return console.error("Erro ao realizar a consulta:", err);
    }
    if (result.length === 0) {
      console.log("Este Usuário não possui Agendamento ativo!");
      return res.status(200).json(null); // Retorna null com status 200 (OK)
    }
    if (result.length > 0) {
      console.log("Este Usuário possui Agendamento ativo!");
      res.json(result[0]);
    }
  });
});

app.get("/verificarAgendamentoHash", (req, res) => {
  console.log("Verificando se possui agendamento Ativo");
  const { idhash } = req.query;
  const query =
    "SELECT agendamento.senha, agendamento.data, agendamento.horario, agendamento.email, agendamento.idhash, aluno.nome FROM agendamento JOIN aluno ON agendamento.email = aluno.email WHERE agendamento.idhash = ? AND agendamento.ativo = true;";

  db.query(query, [idhash], (err, result) => {
    if (err) {
      res.status(500).send("Erro ao realizar a consulta");
      return console.error("Erro ao realizar a consulta:", err);
    }
    if (result.length === 0) {
      console.log("Agendamento não foi encontrado");
      return res.status(200).json(null); // Retorna null com status 200 (OK)
    }
    if (result.length > 0) {
      console.log("Agendamento Encontrado");
      res.json(result[0]);
    }
  });
});


app.get("/contarVagas", (req, res) => {
  const { horario } = req.query;
  const query =
    "SELECT count(*) as count from agendamento where horario = ? and ativo = true;";

  db.query(query, [horario], (err, results) => {
    if (err) {
      res.status(500).send("Erro ao realizar a consulta");
      return console.error("Erro ao realizar a consulta:", err);
    }
    res.send({ count: results[0].count });
  });
});

app.post("/trocarAgendamento", (req, res) => {

  //pegando parâmetros
  const { senha, data, hora, email, ativo } = req.body;
  const dataQrCode = email + " " + hora + " " + data;
  const hash = crypto.createHash('sha256').update(dataQrCode).digest('hex');

  let deleteAgend = "UPDATE agendamento SET ativo = FALSE WHERE email = ?"; // string para cancelar agendamento
  let insertAgend =
    "INSERT INTO agendamento (senha, data, horario, email, ativo, idhash) VALUES (?, ?,  ?, ?, ?, ?)"; //string insert

  // cancela o agendamento do aluno
  db.query(deleteAgend, [email], (err, deleteResult) => {
    // se der erro
    if (err) {
      console.error(err);
      return console.log("Erro ao cancelar o agendamento:", err);
    }
    // se o cancelamento for bem-sucedido
    console.log("Agendamento cancelado com sucesso para o email:", email);

    // agora, agendar o novo horário
    db.query(
      insertAgend,
      [senha, data, hora, email, ativo, hash],
      (err, insertResult) => {
        //se der erro
        // se der erro
        if (err) {
          console.error(err);
          return console.log("Erro ao agendar novo horário:", err);
        }
        //se der certo
        res.json({
          success: true,
          message: "Agendamento feito com sucesso!",
          email: email,
          hash: hash, // Retornando o hash gerado
        });
        return console.log("Agendamento feito com sucesso, %s!", email);
      }
    );
  });
});

app.get("/obterCardapio", (req, res) => {
  console.log("Requisição obter cardapio recebida com Sucesso...");
  const { data, turno } = req.query;
  const SELECT =
    "SELECT principal, opcao, vegetariana, acompanhamentos, guarnicao, salada, sobremesa, data, turno FROM cardapio WHERE data = ? AND turno = ?";

  db.query(SELECT, [data, turno], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(404).send("Erro ao buscar o cardapio");
    }
    if (result.length === 0) {
      console.log("Cardapio desse dia ainda nao foi feito");
      return res.status(500).send("Cardapio desse dia ainda nao foi feito!");
    }
    console.log(result);
    res.json(result[0]);
  });
});

app.post("/criarCardapio", (req, res) => {
  res.send("Requisição criar cardapio recebida com Sucesso");

  //pegando os parametros
  const {
    principal,
    opcao,
    vegetariana,
    acompanhamentos,
    guarnicao,
    salada,
    sobremesa,
    data,
    turno,
  } = req.body;

  db.query("SELECT * FROM cardapio WHERE data = ? AND turno = ?;", [data, turno], (err, result) => {
    if (err) {
      console.error(err);
      return console.log("Erro ao verificar se ja tem o cardapio: ", err);
    }
    else if (result.length === 0) {
      db.query(
        "INSERT INTO cardapio (principal, opcao, vegetariana, acompanhamentos, guarnicao, salada, sobremesa, data, turno) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          principal,
          opcao,
          vegetariana,
          acompanhamentos,
          guarnicao,
          salada,
          sobremesa,
          data,
          turno,
        ],
        (err, result) => {
          //se der erro
          if (err) {
            console.error(err);
            return console.log("Erro ao criar o cardapio: ", err);
          }
          // se a criação for bem-sucedido
          console.log("Cardapio Criado com Sucesso");
        }
      );
    }
    else {
      db.query("UPDATE cardapio SET principal = ?, opcao = ?, vegetariana = ?, acompanhamentos = ?, guarnicao = ?, salada = ?, sobremesa = ? WHERE data = ? AND turno = ?;", [
        principal,
        opcao,
        vegetariana,
        acompanhamentos,
        guarnicao,
        salada,
        sobremesa,
        data,
        turno,
      ], (err, result) => {
        if (err) {
          console.log(err);
          return console.log("Erro ao criar o cardapio: ", err);
        }
        console.log("Cardapio Atualizado com Sucesso");
      }

      );
    }
  }

  )


});




app.listen(3001, () => {
  console.log("Rodando servidor");
});
