import "./App.css";
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
//Generador de nombres aleatorio
var generate = require("project-name-generator");
//Iniciamos el socket
const socket = io("https://socketio-chatserver-1.pedrodel1.repl.co");

let lastX = 0;
let lastY = 0;
let lastZ = 0;

let lastTime = new Date();

function App() {
  //Variables de estado
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [users, setUsers] = useState([]);
  const [messageList, setMessageList] = useState([]);
  const [privateMessageList, setPrivateMessageList] = useState([]);
  const [global, setGlobal] = useState(true);
  const [privateChatWith, setPrivateChatWith] = useState(null);
  const [notMyMessages, setNotMyMessages] = useState(false);
  const [timeRunning, setTimeRunning] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [isAccAvailable, setIsAccAvailable] = useState(false);
  const [canReceiveAccData, setCanReceiveAccData] = useState(false);
  const [selected, setSelected] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [forcedDiscconect, setForcedDisconnect] = useState(false);
  const timerRef = useRef();
  const timerRefAcc = useRef();

  useEffect(() => {
    //Generar nombre de usuario
    var name = generate().dashed;
    setName(name);
    console.log("Nombre de usuario: ", name);

    if ("Accelerometer" in window) {
      setIsAccAvailable(true);
      try {
        const acc = new window.Accelerometer({ frequency: 60 });
        setCanReceiveAccData(true);

        acc.onreading = () => {
          const options = {
            threshold: 15
          };
          const deltaX = Math.abs(lastX - acc.x);
          const deltaY = Math.abs(lastY - acc.y);
          const deltaZ = Math.abs(lastZ - acc.z);

          if (
            (deltaX > options.threshold && deltaY > options.threshold) ||
            (deltaX > options.threshold && deltaZ > options.threshold) ||
            (deltaY > options.threshold && deltaZ > options.threshold)
          ) {
            if (!shaking) {
              console.log("shake");
              setShaking(true);
              if (timerRef.current > 0) {
                clearTimeout(timerRef.current);
                setTimeRunning(false);
                timerRef.current = null;
                alert("Mensaje borrado");
              }

              if (timerRefAcc) {
                clearTimeout(timerRefAcc.current);
                timerRefAcc.current = null;
              }
            }
          } else {
            if (shaking) {
              setShaking(false);
              timerRefAcc.current = setTimeout(() => {
                console.log("stop");
                document.body.style.backgroundColor = "white";
                timerRefAcc.current = null;
              }, 500);
            }
          }

          lastX = acc.x;
          lastY = acc.y;
          lastZ = acc.z;
        };

        acc.start();
      } catch (err) {
        setCanReceiveAccData(false);
        console.log(err);
      }
    }

    //Conectar socket
    socket.on("connect", () => {
      console.log("connected");
      socket.emit("new_user", { user: name });
    });

    //Nuevo usuario conectado
    socket.on("new_user", (usuarios) => {
      setUsers(() => {
        const newUserList = [...usuarios];
        return newUserList;
      });
    });

    //Mensaje al chat global
    socket.on("message_evt", (message) => {
      console.log("message received from server ", message);
      setMessageList((oldMessageList) => {
        const newMessageList = [...oldMessageList];
        newMessageList.push(message);
        return newMessageList;
      });
    });
    socket.on("message_private", (message) => {
      console.log("Private message received from server ", message);
      setPrivateMessageList((oldPrivateMessageList) => {
        const newPrivateMessageList = [...oldPrivateMessageList];
        newPrivateMessageList.push(message);
        return newPrivateMessageList;
      });
    });

    //Borrar un usuario de la lista
    socket.on("remove_user", (data) => {
      console.log("El usuario ", data.username, " ha salido del chat");
      setUsers((users) => {
        return users.filter((user) => user != data.username);
      });
    });
    socket.on("trivia", async () => {
      console.log("TE HAN ELEGIDO PARA RESPONDER UNA PREGUNTA");
      setSelected(true);
      const res = await fetch(
        "https://opentdb.com/api.php?amount=1&difficulty=easy&type=boolean"
      );
      const data = await res.json();
      console.log(data);
      setQuestion(data.results[0].question);
      setAnswer(data.results[0].correct_answer);
    });
  }, []);

  //Handle de mandar mensaje
  function handleOnClickSend() {
    //Al chat global
    if (global) {
      socket.emit("message_evt", { user: name, msg: message });
      setMessageList((oldMessageList) => {
        const newMessageList = [...oldMessageList];
        newMessageList.push({ user: name, msg: message });
        return newMessageList;
      });
    }
    //A chats privados
    if (!global) {
      socket.emit("message_private", {
        user: name,
        msg: message,
        destination: privateChatWith
      });
      setPrivateMessageList((oldPrivateMessageList) => {
        const newPrivateMessageList = [...oldPrivateMessageList];
        newPrivateMessageList.push({
          user: name,
          msg: message,
          destination: privateChatWith
        });
        return newPrivateMessageList;
      });
    }
  }
  //Handle para controlar el envío con temporizador
  function handleOnClickTimerSend() {
    alert(
      "Temporizador avanzando. Tiene 10 segundos para eliminar el mensaje sacudiendo el móvil."
    );
    setTimeRunning(true);
    timerRef.current = setTimeout(() => {
      if (global) {
        socket.emit("message_evt", { user: name, msg: message });
        setMessageList((oldMessageList) => {
          const newMessageList = [...oldMessageList];
          newMessageList.push({ user: name, msg: message });
          return newMessageList;
        });
      }
      if (!global) {
        socket.emit("message_private", {
          user: name,
          msg: message,
          destination: privateChatWith
        });
        setPrivateMessageList((oldPrivateMessageList) => {
          const newPrivateMessageList = [...oldPrivateMessageList];
          newPrivateMessageList.push({
            user: name,
            msg: message,
            destination: privateChatWith
          });
          return newPrivateMessageList;
        });
      }
      setTimeRunning(false);
      alert("Mensaje enviado.");
      timerRef.current = null;
    }, 10000);
  }
  //Handle para confirmar envío con temporizador
  function handleOnClickConfirmSend() {
    clearTimeout(timerRef.current);
    setTimeRunning(false);
    timerRef.current = null;
    if (global) {
      socket.emit("message_evt", { user: name, msg: message });
      setMessageList((oldMessageList) => {
        const newMessageList = [...oldMessageList];
        newMessageList.push({ user: name, msg: message });
        return newMessageList;
      });
    }
    if (!global) {
      socket.emit("message_private", {
        user: name,
        msg: message,
        destination: privateChatWith
      });
      setPrivateMessageList((oldPrivateMessageList) => {
        const newPrivateMessageList = [...oldPrivateMessageList];
        newPrivateMessageList.push({
          user: name,
          msg: message,
          destination: privateChatWith
        });
        return newPrivateMessageList;
      });
    }
  }

  //Handle cambios en el mensaje
  function handleOnChange(e) {
    setMessage(e.target.value);
  }
  //Div para que se vaya el chat hacia abajo automaticamente
  const divRef = useRef(null);
  useEffect(() => {
    divRef.current.scrollIntoView({ behavior: "smooth" });
  });
  //Handle on click de la lista de usuarios
  function handleOnClickUser(name) {
    setGlobal(false);
    setPrivateChatWith(name);
  }
  //Handle on click para volver al chat global
  function handleOnClickBackGlobal(e) {
    setPrivateChatWith(null);
    setGlobal(true);
  }
  //Handle para no mostrar los mensajes propios
  function handleOnClicknotMyMessages(e) {
    if (notMyMessages) {
      setNotMyMessages(false);
    } else {
      setNotMyMessages(true);
    }
  }
  function ModalDialog() {
    return (
      <div className="modal-dialog">
        <div className="questionDiv">
          <p>
            !HAS SIDO SELECCIONADO PARA RESPONDER UNA PREGUNTA! RESPONDE
            CORRECTAMENTE PARA MANTENERTE EN EL CHAT
          </p>
          <h3>{question}</h3>

          <button onClick={answerTrue}>True</button>
          <button onClick={answerFalse}>False</button>
        </div>
      </div>
    );
  }
  function answerTrue() {
    setUserAnswer("True");
    //compareAnswers();
  }
  function answerFalse() {
    setUserAnswer("False");
    //compareAnswers();
  }

  useEffect(() => {
    //console.log("Comparamos ", userAnswer, answer);
    if (userAnswer === answer) {
      setSelected(false);
    } else {
      setSelected(false);
      socket.disconnect();
      console.log("You've been disconnected");
      setForcedDisconnect(true);
    }
  }, [userAnswer]);

  function FailedAnswer() {
    return (
      <div className="forced-disconnect">
        <h1>You've been disconnected</h1>
        <h4>You failed your answer, you don't deserve to stay in this chat</h4>
      </div>
    );
  }

  //Retorno del componente
  return (
    <div className="App">
      <div>
        <h4>Nombre de usuario: {name}</h4>
        <button className="notMyMessages" onClick={handleOnClicknotMyMessages}>
          {" "}
          Not My Messages
        </button>
      </div>
      {global && (
        <div className="chat">
          {messageList.map((e, i) => {
            if (e.user == name && !notMyMessages) {
              return (
                <div key={i} className="message">
                  <p>{e.msg}</p>
                  <span>{e.user}</span>
                </div>
              );
            } else if (e.user == "server") {
              return (
                <div key={i} className="serverMessage">
                  <p>{e.msg}</p>
                </div>
              );
            } else if (e.user != name) {
              return (
                <div key={i} className="messageOther">
                  <p>{e.msg}</p>
                  <span>{e.user}</span>
                </div>
              );
            }
          })}
          <div ref={divRef}></div>
        </div>
      )}
      {!global && (
        <div className="chat">
          <h4>Chat privado con {privateChatWith}</h4>
          <a href="#" onClick={handleOnClickBackGlobal}>
            Volver al chat global
          </a>
          {privateMessageList.map((e, i) => {
            if (
              e.user == name &&
              e.destination == privateChatWith &&
              !notMyMessages
            ) {
              return (
                <div key={i} className="message">
                  <p>{e.msg}</p>
                  <span>{e.user}</span>
                </div>
              );
            } else if (e.user == privateChatWith) {
              return (
                <div key={i} className="messageOther">
                  <p>{e.msg}</p>
                  <span>{e.user}</span>
                </div>
              );
            }
          })}
          <div ref={divRef}></div>
        </div>
      )}
      <div className="Userlist">
        <h4>Lista de usuarios:</h4>
        {users.map((e, i) => (
          <div key={i}>
            <div onClick={(e) => handleOnClickUser(e.target.innerHTML)}>
              {e}
            </div>
          </div>
        ))}
      </div>
      <input
        type="text"
        placeholder="Message"
        onChange={handleOnChange}
      ></input>
      <button onClick={handleOnClickSend}>Send</button>
      {!timeRunning && (
        <button onClick={handleOnClickTimerSend}>Timer Send</button>
      )}
      {timeRunning && (
        <button onClick={handleOnClickConfirmSend}>Confirm</button>
      )}
      {selected && <ModalDialog />}
      {forcedDiscconect && <FailedAnswer />}
    </div>
  );
}

export default App;
