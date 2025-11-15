// frontend/src/components/Asistente.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaLightbulb, FaExclamationTriangle } from 'react-icons/fa';
import './Asistente.css';

const Asistente = () => {
  const [mensajes, setMensajes] = useState([]);
  
  useEffect(() => {
    axios.get('http://localhost:3001/api/dashboard/summary')
      .then(response => {
        const summary = response.data;
        const nuevosMensajes = [];
        const hora = new Date().getHours();

        // Saludo según la hora
        if (hora < 12) {
          nuevosMensajes.push({
            tipo: 'saludo',
            texto: '¡Buenos días! Un nuevo día para vender.'
          });
        } else if (hora < 18) {
          nuevosMensajes.push({
            tipo: 'saludo',
            texto: '¡Buenas tardes! ¿Cómo van las ventas?'
          });
        }

        // Consejo basado en ventas
        if (summary.ventas_hoy > 0) {
            nuevosMensajes.push({
                tipo: 'consejo',
                icon: <FaLightbulb />,
                texto: `¡Excelente! Ya has vendido $${summary.ventas_hoy.toLocaleString('es-CO')} hoy.`
            });
        }
        
        // Alerta basada en stock bajo
        if (summary.productos_bajos > 0) {
          nuevosMensajes.push({
            tipo: 'alerta',
            icon: <FaExclamationTriangle />,
            texto: `¡Ojo! Tienes ${summary.productos_bajos} producto(s) con bajo inventario. Revisa tu stock.`
          });
        }

        setMensajes(nuevosMensajes);
      })
      .catch(error => console.error("Error en el asistente:", error));
  }, []);

  return (
    <aside className="asistente-panel">
      <h3>Asistente Inteligente</h3>
      <div className="mensajes-container">
        {mensajes.map((msg, index) => (
          <div key={index} className={`mensaje ${msg.tipo}`}>
            <span className="mensaje-icon">{msg.icon}</span>
            <p>{msg.texto}</p>
          </div>
        ))}
      </div>
      <div className="chat-input-area">
        <textarea placeholder="Escribe tu consulta aquí... (Función en desarrollo)"></textarea>
        <button disabled>Enviar Mensaje</button>
      </div>
    </aside>
  );
};

export default Asistente;