// frontend/src/components/Asistente.js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  FaLightbulb, 
  FaExclamationTriangle, 
  FaChartLine, 
  FaCreditCard, 
  FaMoneyBillWave,
  FaBrain,
  FaPaperPlane,
  FaChevronRight,
  FaChevronLeft
} from 'react-icons/fa';
import './Asistente.css';

const Asistente = () => {
  const [mensajes, setMensajes] = useState([]);
  const [inputMensaje, setInputMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modoIA, setModoIA] = useState(false);
  const [colapsado, setColapsado] = useState(false); // NUEVO: estado para colapsar
  const mensajesEndRef = useRef(null);

  // Auto-scroll al último mensaje
  const scrollToBottom = () => {
    mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensajes]);

  // Cargar mensajes iniciales al montar
  useEffect(() => {
    cargarMensajesIniciales();
  }, []);

  const cargarMensajesIniciales = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/dashboard/summary');
      const summary = response.data;
      const nuevosMensajes = [];
      const hora = new Date().getHours();

      // Saludo según la hora
      if (hora < 12) {
        nuevosMensajes.push({
          tipo: 'sistema',
          texto: '¡Buenos días! Un nuevo día para vender.',
          timestamp: new Date()
        });
      } else if (hora < 18) {
        nuevosMensajes.push({
          tipo: 'sistema',
          texto: '¡Buenas tardes! ¿Cómo van las ventas?',
          timestamp: new Date()
        });
      } else {
        nuevosMensajes.push({
          tipo: 'sistema',
          texto: '¡Buenas noches! Revisemos cómo fue el día.',
          timestamp: new Date()
        });
      }

      // Consejo basado en ventas
      if (summary.ventas_hoy > 0) {
        nuevosMensajes.push({
          tipo: 'consejo',
          icon: <FaLightbulb />,
          texto: `¡Excelente! Ya has vendido $${summary.ventas_hoy.toLocaleString('es-CO')} hoy.`,
          timestamp: new Date()
        });
      }

      // Alerta basada en stock bajo
      if (summary.productos_bajos > 0) {
        nuevosMensajes.push({
          tipo: 'alerta',
          icon: <FaExclamationTriangle />,
          texto: `¡Ojo! Tienes ${summary.productos_bajos} producto(s) con bajo inventario. Revisa tu stock.`,
          timestamp: new Date()
        });
      }

      setMensajes(nuevosMensajes);
    } catch (error) {
      console.error("Error cargando mensajes iniciales:", error);
    }
  };

  const enviarMensaje = async () => {
    if (!inputMensaje.trim()) return;

    const mensajeUsuario = {
      tipo: 'usuario',
      texto: inputMensaje,
      timestamp: new Date()
    };

    setMensajes(prev => [...prev, mensajeUsuario]);
    setInputMensaje('');
    setCargando(true);

    try {
      const response = await axios.post('http://localhost:3001/api/ai/chat', {
        message: inputMensaje
      });

      const mensajeIA = {
        tipo: 'ia',
        icon: <FaBrain />,
        texto: response.data.respuesta,
        timestamp: new Date()
      };

      setMensajes(prev => [...prev, mensajeIA]);
    } catch (error) {
      console.error("Error al enviar mensaje:", error);
      const mensajeError = {
        tipo: 'error',
        icon: <FaExclamationTriangle />,
        texto: error.response?.data?.error || 'Error al conectar con el asistente. Asegúrate de que Ollama esté corriendo.',
        timestamp: new Date()
      };
      setMensajes(prev => [...prev, mensajeError]);
    } finally {
      setCargando(false);
    }
  };

  const consultarPrediccionDemanda = async () => {
    setCargando(true);
    
    const mensajeSistema = {
      tipo: 'sistema',
      icon: <FaChartLine />,
      texto: '📊 Analizando patrones de demanda...',
      timestamp: new Date()
    };
    setMensajes(prev => [...prev, mensajeSistema]);

    try {
      const response = await axios.post('http://localhost:3001/api/ai/predict-demand');
      
      const mensajeIA = {
        tipo: 'ia-especial',
        icon: <FaChartLine />,
        titulo: 'Predicción de Demanda',
        texto: response.data.respuesta,
        timestamp: new Date()
      };

      setMensajes(prev => [...prev, mensajeIA]);
    } catch (error) {
      console.error("Error en predicción de demanda:", error);
    } finally {
      setCargando(false);
    }
  };

  const consultarAnalisisPrecios = async () => {
    setCargando(true);
    
    const mensajeSistema = {
      tipo: 'sistema',
      icon: <FaMoneyBillWave />,
      texto: '💰 Analizando estrategia de precios...',
      timestamp: new Date()
    };
    setMensajes(prev => [...prev, mensajeSistema]);

    try {
      const response = await axios.post('http://localhost:3001/api/ai/price-assistant');
      
      const mensajeIA = {
        tipo: 'ia-especial',
        icon: <FaMoneyBillWave />,
        titulo: 'Análisis de Precios',
        texto: response.data.respuesta,
        timestamp: new Date()
      };

      setMensajes(prev => [...prev, mensajeIA]);
    } catch (error) {
      console.error("Error en análisis de precios:", error);
    } finally {
      setCargando(false);
    }
  };

  const consultarInsightsNegocio = async () => {
    setCargando(true);
    
    const mensajeSistema = {
      tipo: 'sistema',
      icon: <FaBrain />,
      texto: '🧠 Generando análisis completo del negocio...',
      timestamp: new Date()
    };
    setMensajes(prev => [...prev, mensajeSistema]);

    try {
      const response = await axios.post('http://localhost:3001/api/ai/business-insights');
      
      const mensajeIA = {
        tipo: 'ia-especial',
        icon: <FaBrain />,
        titulo: 'Análisis del Negocio',
        texto: response.data.respuesta,
        timestamp: new Date()
      };

      setMensajes(prev => [...prev, mensajeIA]);
    } catch (error) {
      console.error("Error en análisis de negocio:", error);
    } finally {
      setCargando(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  return (
    <aside className={`asistente-panel ${colapsado ? 'colapsado' : ''}`}>
      {/* NUEVO: Botón para colapsar/expandir */}
      <button 
        className="toggle-collapse-btn"
        onClick={() => setColapsado(!colapsado)}
        title={colapsado ? 'Expandir asistente' : 'Ocultar asistente'}
      >
        {colapsado ? <FaChevronLeft /> : <FaChevronRight />}
      </button>

      <div className="asistente-content">
        <div className="asistente-header">
          <h3>
            <FaBrain /> Asistente Inteligente
          </h3>
          <button 
            className={`toggle-ia ${modoIA ? 'activo' : ''}`}
            onClick={() => setModoIA(!modoIA)}
            title="Activar/Desactivar IA"
          >
            {modoIA ? '🤖 IA Activa' : '💡 IA'}
          </button>
        </div>

        {modoIA && (
          <div className="acciones-rapidas">
            <button 
              className="accion-btn demanda"
              onClick={consultarPrediccionDemanda}
              disabled={cargando}
            >
              <FaChartLine /> Predecir Demanda
            </button>
            <button 
              className="accion-btn precios"
              onClick={consultarAnalisisPrecios}
              disabled={cargando}
            >
              <FaMoneyBillWave /> Análisis Precios
            </button>
            <button 
              className="accion-btn insights"
              onClick={consultarInsightsNegocio}
              disabled={cargando}
            >
              <FaBrain /> Insights Negocio
            </button>
          </div>
        )}

        <div className="mensajes-container">
          {mensajes.map((msg, index) => (
            <div key={index} className={`mensaje ${msg.tipo}`}>
              {msg.icon && <span className="mensaje-icon">{msg.icon}</span>}
              <div className="mensaje-content">
                {msg.titulo && <strong className="mensaje-titulo">{msg.titulo}</strong>}
                <p style={{ whiteSpace: 'pre-line' }}>{msg.texto}</p>
              </div>
            </div>
          ))}
          {cargando && (
            <div className="mensaje ia">
              <span className="mensaje-icon"><FaBrain /></span>
              <div className="mensaje-content">
                <p className="typing-indicator">
                  <span></span><span></span><span></span>
                </p>
              </div>
            </div>
          )}
          <div ref={mensajesEndRef} />
        </div>

        <div className="chat-input-area">
          <textarea
            value={inputMensaje}
            onChange={(e) => setInputMensaje(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={modoIA ? "Pregunta lo que necesites..." : "Activa la IA para consultar"}
            disabled={!modoIA || cargando}
            rows="2"
          />
          <button 
            onClick={enviarMensaje}
            disabled={!modoIA || cargando || !inputMensaje.trim()}
          >
            <FaPaperPlane /> Enviar
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Asistente;