import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:3001/api/login', { email, password });
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            toast.success(`¡Bienvenido, ${response.data.user.nombre}!`);
            navigate('/'); // Redirige al dashboard
        } catch (error) {
            toast.error('Credenciales incorrectas. Por favor, intente de nuevo.');
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h2>SIG-Tienda</h2>
                <p>Inicia sesión para continuar</p>
                <form onSubmit={handleSubmit}>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo Electrónico" required />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" required />
                    <button type="submit">Ingresar</button>
                </form>
            </div>
        </div>
    );
};

export default Login;