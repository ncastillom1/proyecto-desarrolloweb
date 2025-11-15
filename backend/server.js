const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuración de SQLite
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error al conectar a la base de datos:", err);
  } else {
    console.log("Conexión a la base de datos exitosa");
  }
});

// Crear tablas si no existen
db.serialize(() => {
  // Tabla de Usuarios
  db.run(`CREATE TABLE IF NOT EXISTS Usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL,
    activo INTEGER DEFAULT 1
  )`);

  // Tabla de Clinicas
  db.run(`CREATE TABLE IF NOT EXISTS Clinicas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    color TEXT DEFAULT '#007bff'
  )`);

  // Tabla de Turnos
  db.run(`CREATE TABLE IF NOT EXISTS Turnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_nombre TEXT NOT NULL,
    paciente_identificacion TEXT NOT NULL,
    paciente_telefono TEXT,
    clinica_id INTEGER NOT NULL,
    numero_turno TEXT NOT NULL,
    estado TEXT DEFAULT 'espera',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // Tabla de Appointments
  db.run(`CREATE TABLE IF NOT EXISTS Appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    clinica_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    reassignment_reason TEXT,
    fecha_modificacion DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS MedicalData (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    patientName TEXT,
    age INTEGER,
    medicalHistory TEXT
  )`);

  db.run(`INSERT INTO MedicalData (patient_id, patientName, age, medicalHistory)
  VALUES (1, 'John Doe', 30, 'No known allergies')`);

  // Insertar datos iniciales
  db.get("SELECT COUNT(*) as count FROM Clinicas", (err, row) => {
    if (row.count === 0) {
      db.run(`INSERT INTO Clinicas (nombre, descripcion) VALUES 
        ('Medicina General', 'Consulta de medicina general'),
        ('Pediatría', 'Atención para niños'),
        ('Ginecología', 'Salud femenina'),
        ('Traumatología', 'Lesiones óseas y musculares')`);
      console.log('✅ Datos de clínicas insertados');
    }
  });

  db.get("SELECT COUNT(*) as count FROM Usuarios WHERE email = 'enfermero@hospital.com'", (err, row) => {
    if (row.count === 0) {
      db.run(`INSERT INTO Usuarios (email, password, nombre, rol) VALUES 
        ('enfermero@hospital.com', 'password', 'Ana López', 'enfermero'),
        ('medico@hospital.com', 'password', 'Dr. Carlos Ruiz', 'medico')`);
      console.log('✅ Usuarios de prueba creados');
    }
  });

  console.log('✅ Base de datos SQLite configurada correctamente');

  // Iniciar el servidor Express
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor Express escuchando en el puerto ${PORT}`);
  });
});

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ mensaje: '🚀 Sistema de Colas Médicas funcionando con SQLite!' });
});

// Ruta de login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM Usuarios WHERE email = ? AND activo = 1', [email], (err, usuario) => {
    if (err || !usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (password === usuario.password) {
      const token = jwt.sign(
        { id: usuario.id, email: usuario.email, rol: usuario.rol },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol
        }
      });
    } else {
      res.status(401).json({ error: 'Credenciales inválidas' });
    }
  });
});

app.post('/api/register', (req, res) => {
  const { nombre, email, password, clinica_id } = req.body;

  // Validate required fields
  if (!nombre || !email || !password || !clinica_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Insert the new patient into the database
  db.run(
    `INSERT INTO Patients (nombre, email, password, clinica_id) VALUES (?, ?, ?, ?)`,
    [nombre, email, password, clinica_id],
    function(err) {
      if (err) {
        console.error('Error registering patient:', err);
        return res.status(500).json({ error: 'Server error: ' + err.message });
      }

      // Return success message
      res.json({
        success: true,
        message: 'Patient registered successfully',
        patient: {
          id: this.lastID,
          nombre: nombre,
          email: email,
          clinica_id: clinica_id
        }
      });
    }
  );
});

app.get('/api/clinics', (req, res) => {
  db.all('SELECT id, nombre FROM Clinicas', (err, clinics) => {
    if (err) {
      console.error('Error fetching clinics:', err);
      return res.status(500).json({ error: 'Server error: ' + err.message });
    }
    res.json(clinics);
  });
});

// Ruta para crear una nueva cita
app.post('/api/appointments', authenticateToken, (req, res) => {
    const { patient_id, clinica_id, fecha, hora } = req.body;

    // Validar datos requeridos
    if (!patient_id || !clinica_id || !fecha || !hora) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insertar la nueva cita en la base de datos
    db.run(
        `INSERT INTO Appointments (patient_id, clinica_id, fecha, hora) VALUES (?, ?, ?, ?)`,
        [patient_id, clinica_id, fecha, hora],
        function (err) {
            if (err) {
                console.error('Error creating appointment:', err);
                return res.status(500).json({ error: 'Server error: ' + err.message });
            }

            // Devolver mensaje de éxito
            res.json({
                success: true,
                message: 'Appointment created successfully',
                appointment: {
                    id: this.lastID,
                    patient_id: patient_id,
                    clinica_id: clinica_id,
                    fecha: fecha,
                    hora: hora
                }
            });
        }
    );
});

// Ruta para obtener, actualizar o eliminar una cita existente
app.route('/api/appointments/:id')
    .get(authenticateToken, (req, res) => {
        const appointmentId = req.params.id;

        // Obtener la cita de la base de datos
        db.get('SELECT * FROM Appointments WHERE id = ?', [appointmentId], (err, appointment) => {
            if (err) {
                console.error('Error fetching appointment:', err);
                return res.status(500).json({ error: 'Server error: ' + err.message });
            }

            if (!appointment) {
                return res.status(404).json({ message: 'Appointment not found' });
            }

            // Devolver la cita
            res.json(appointment);
        });
    })
    .put(authenticateToken, (req, res) => {
        const appointmentId = req.params.id;
        const { patient_id, clinica_id, fecha, hora } = req.body;

        // Validar datos requeridos
        if (!patient_id || !clinica_id || !fecha || !hora) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Actualizar la cita en la base de datos
        db.run(
            `UPDATE Appointments SET patient_id = ?, clinica_id = ?, fecha = ?, hora = ? WHERE id = ?`,
            [patient_id, clinica_id, fecha, hora, appointmentId],
            function (err) {
                if (err) {
                    console.error('Error updating appointment:', err);
                    return res.status(500).json({ error: 'Server error: ' + err.message });
                }

                // Devolver mensaje de éxito
                res.json({
                    success: true,
                    message: 'Appointment updated successfully',
                    appointment: {
                        id: appointmentId,
                        patient_id: patient_id,
                        clinica_id: clinica_id,
                        fecha: fecha,
                        hora: hora
                    }
                });
            }
        );
    })
    .delete(authenticateToken, (req, res) => {
        const appointmentId = req.params.id;

        // Eliminar la cita de la base de datos
        db.run('DELETE FROM Appointments WHERE id = ?', [appointmentId], function (err) {
            if (err) {
                console.error('Error deleting appointment:', err);
                return res.status(500).json({ error: 'Server error: ' + err.message });
            }

            // Devolver mensaje de éxito
            res.json({
                success: true,
                message: 'Appointment deleted successfully'
            });
        });
    
    // Ruta para reasignar una cita existente
    app.put('/api/appointments/:id/reassign', authenticateToken, (req, res) => {
        const appointmentId = req.params.id;
        const { clinica_id, reassignmentReason } = req.body;
    
        // Validar datos requeridos
        if (!clinica_id || !reassignmentReason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
    
        // Actualizar la cita en la base de datos
        db.run(
            `UPDATE Appointments SET clinica_id = ?, reassignment_reason = ?, fecha_modificacion = DATETIME('now') WHERE id = ?`,
            [clinica_id, reassignmentReason, appointmentId],
            function (err) {
                if (err) {
                    console.error('Error updating appointment:', err);
                    return res.status(500).json({ error: 'Server error: ' + err.message });
                }
    
                // Devolver mensaje de éxito
                res.json({
                    success: true,
                    message: 'Appointment updated successfully',
                    appointment: {
                        id: appointmentId,
                        clinica_id: clinica_id,
                        reassignmentReason: reassignmentReason
                    }
                });
            }
        );
    });
    
    // Ruta para reasignar una cita existente
    app.put('/api/appointments/:id/reassign', authenticateToken, (req, res) => {
        const appointmentId = req.params.id;
        const { clinica_id, reassignmentReason } = req.body;
    
        // Validar datos requeridos
        if (!clinica_id || !reassignmentReason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
    
        // Actualizar la cita en la base de datos
        db.run(
            `UPDATE Appointments SET clinica_id = ?, reassignment_reason = ?, fecha_modificacion = DATETIME('now') WHERE id = ?`,
            [clinica_id, reassignmentReason, appointmentId],
            function (err) {
                if (err) {
                    console.error('Error updating appointment:', err);
                    return res.status(500).json({ error: 'Server error: ' + err.message });
                }
    
                // Devolver mensaje de éxito
                res.json({
                    success: true,
                    message: 'Appointment updated successfully',
                    appointment: {
                        id: appointmentId,
                        clinica_id: clinica_id,
                        reassignmentReason: reassignmentReason
                    }
                });
            }
        );
    });
    });

// Ruta para crear nuevo turno - CON DEBUG
app.post('/api/turnos', authenticateToken, (req, res) => {
  console.log('🔍 DEBUG: Solicitud recibida en /api/turnos');
  console.log('🔍 DEBUG: Body recibido:', req.body);
  
  const { nombre, identificacion, telefono, clinica_id, prioridad } = req.body;

  // Validar datos requeridos
  if (!nombre || !identificacion || !clinica_id) {
    console.log('❌ DEBUG: Faltan datos requeridos');
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  console.log('🔍 DEBUG: Contando turnos...');
  db.get("SELECT COUNT(*) as count FROM Turnos", (err, row) => {
    if (err) {
      console.error('❌ DEBUG: Error contando turnos:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }

    const numeroTurno = `T-${String(row.count + 1).padStart(3, '0')}`;
    console.log('🔍 DEBUG: Número de turno generado:', numeroTurno);

    console.log('🔍 DEBUG: Insertando en base de datos...');
    db.run(
      `INSERT INTO Turnos (paciente_nombre, paciente_identificacion, paciente_telefono, clinica_id, numero_turno, estado) 
       VALUES (?, ?, ?, ?, ?, 'espera')`,
      [nombre, identificacion, telefono, clinica_id, numeroTurno],
      function(err) {
        if (err) {
          console.error('❌ DEBUG: Error insertando turno:', err);
          return res.status(500).json({ error: 'Error del servidor: ' + err.message });
        }

        console.log('✅ DEBUG: Turno insertado exitosamente. ID:', this.lastID);
        
        res.json({ 
          success: true, 
          message: 'Turno creado exitosamente',
          turno: {
            id: this.lastID,
            numero_turno: numeroTurno,
            paciente_nombre: nombre,
            clinica_id: clinica_id
          }
        });
        
        const WebSocket = require('ws');
        
        // Crear un WebSocket Server
        const wss = new WebSocket.Server({ port: 8080 });
        
        // Conexiones de clientes
        wss.on('connection', ws => {
            console.log('Client connected');
        
            ws.on('close', () => console.log('Client disconnected'));
        });
        
        // Función para enviar actualizaciones de la cola en tiempo real
        function sendQueueUpdates() {
            db.all(`
                SELECT
                    t.id,
                    t.numero_turno,
                    t.estado,
                    t.fecha_creacion,
                    t.paciente_nombre,
                    t.paciente_identificacion,
                    c.nombre as nombre_clinica,
                    c.color
                FROM Turnos t
                INNER JOIN Clinicas c ON t.clinica_id = c.id
                WHERE t.estado = 'espera'
                ORDER BY t.fecha_creacion ASC
            `, (err, turnos) => {
                if (err) {
                    console.error('Error obteniendo turnos:', err);
                    return;
                }
        
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'queue_update', queue: turnos }));
                    }
                });
            });
        }
        
        // Enviar actualizaciones de la cola cada 5 segundos
        setInterval(sendQueueUpdates, 5000);
        
        // Modificar las rutas para llamar a sendQueueUpdates()
        // Ruta para crear nuevo turno
        app.post('/api/turnos', authenticateToken, (req, res) => {
            // ... (código existente) ...
            db.run(
                `INSERT INTO Turnos (paciente_nombre, paciente_identificacion, paciente_telefono, clinica_id, numero_turno, estado)
                VALUES (?, ?, ?, ?, ?, 'espera')`,
                [nombre, identificacion, telefono, clinica_id, numeroTurno],
                function(err) {
                    if (err) {
                        console.error('❌ DEBUG: Error insertando turno:', err);
                        return res.status(500).json({ error: 'Error del servidor: ' + err.message });
                    }
        
                    console.log('✅ DEBUG: Turno insertado exitosamente. ID:', this.lastID);
        
                    res.json({
                        success: true,
                        message: 'Turno creado exitosamente',
                        turno: {
                            id: this.lastID,
                            numero_turno: numeroTurno,
                            paciente_nombre: nombre,
                            clinica_id: clinica_id
                        }
                    });
        
                    sendQueueUpdates(); // Enviar actualización después de crear un nuevo turno
                }
            );
        });
        
        // Ruta para llamar al siguiente paciente
        app.post('/api/turnos/llamar', authenticateToken, (req, res) => {
            // ... (código existente) ...
            db.run("UPDATE Turnos SET estado = 'atendiendo' WHERE id = ?", [turno.id], function(err) {
                if (err) {
                    console.error('Error al actualizar el estado del turno:', err);
                    return res.status(500).json({ error: 'Error al actualizar el estado del turno' });
                }
        
                res.json({
                    success: true,
                    message: 'Llamando al siguiente paciente',
                    turno: turno
                });
        
                sendQueueUpdates(); // Enviar actualización después de llamar al siguiente paciente
            });
        });
        
        // Ruta para finalizar la consulta
        app.post('/api/turnos/finalizar/:id', authenticateToken, (req, res) => {
            // ... (código existente) ...
            db.run("UPDATE Turnos SET estado = 'finalizado' WHERE id = ?", [turnoId], function(err) {
                if (err) {
                    console.error('Error al finalizar el turno:', err);
                    return res.status(500).json({ error: 'Error al finalizar el turno' });
                }
        
                res.json({
                    success: true,
                    message: 'Turno finalizado exitosamente'
                });
        
                sendQueueUpdates(); // Enviar actualización después de finalizar la consulta
            });
        });
        
        // Ruta para marcar ausencias
        app.post('/api/turnos/ausente/:id', authenticateToken, (req, res) => {
            // ... (código existente) ...
            db.run("UPDATE Turnos SET estado = 'ausente' WHERE id = ?", [turnoId], function(err) {
                if (err) {
                    console.error('Error al marcar ausente el turno:', err);
                    return res.status(500).json({ error: 'Error al marcar ausente el turno' });
                }
        
                res.json({
                    success: true,
                    message: 'Turno marcado como ausente exitosamente'
                });
        
                sendQueueUpdates(); // Enviar actualización después de marcar ausente
            });
        });
      }
    );
  });
});

// Ruta para obtener todos los turnos
app.get('/api/turnos', authenticateToken, (req, res) => {
  db.all(`
    SELECT 
      t.id,
      t.numero_turno,
      t.estado,
      t.fecha_creacion,
      t.paciente_nombre,
      t.paciente_identificacion,
      c.nombre as nombre_clinica,
      c.color
    FROM Turnos t
    INNER JOIN Clinicas c ON t.clinica_id = c.id
    WHERE t.estado = 'espera'
    ORDER BY t.fecha_creacion ASC
  `, (err, turnos) => {
    if (err) {
      console.error('Error obteniendo turnos:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }

    res.json(turnos);
  });
});

// Ruta para llamar al siguiente paciente
app.post('/api/turnos/llamar', authenticateToken, (req, res) => {
  // Buscar el siguiente turno en estado 'espera'
  db.get("SELECT id, paciente_nombre, clinica_id, numero_turno FROM Turnos WHERE estado = 'espera' ORDER BY fecha_creacion ASC LIMIT 1", (err, turno) => {
    if (err) {
      console.error('Error al buscar el siguiente turno:', err);
      return res.status(500).json({ error: 'Error al buscar el siguiente turno: ' + err.message });
    }

    if (!turno) {
      db.get("SELECT COUNT(*) AS count FROM Turnos WHERE estado = 'espera'", (err, count) => {
        if (err) {
          console.error('Error getting count of turnos:', err);
          return res.status(500).json({ error: 'Error getting count of turnos: ' + err.message });
        } else {
          console.log('Number of turnos in espera:', count.count);
          if (count.count === 0) {
            console.log('No turnos in espera: 0');
          }
        }
        return res.status(404).json({ message: 'No hay turnos en espera' });
      });
    } else {
      console.log('Turno encontrado:', turno);
      // Actualizar el estado del turno a 'atendiendo'
      db.run("UPDATE Turnos SET estado = 'atendiendo' WHERE id = ?", [turno.id], function(err) {
        if (err) {
          console.error('Error al actualizar el estado del turno:', err);
          return res.status(500).json({ error: 'Error al actualizar el estado del turno: ' + err.message });
        }

        res.json({
          success: true,
          message: 'Llamando al siguiente paciente',
          turno: turno
        });
      });
    }
  });
});

// Ruta para finalizar la consulta
app.post('/api/turnos/finalizar/:id', authenticateToken, (req, res) => {
  const turnoId = req.params.id;

  // Actualizar el estado del turno a 'finalizado'
  db.run("UPDATE Turnos SET estado = 'finalizado' WHERE id = ?", [turnoId], function(err) {
    if (err) {
      console.error('Error al finalizar el turno:', err);
      return res.status(500).json({ error: 'Error al finalizar el turno' });
    }

    res.json({ 
      success: true, 
      message: 'Turno finalizado exitosamente'
    });
  });
});

// Ruta para marcar ausencias
app.post('/api/turnos/ausente/:id', authenticateToken, (req, res) => {
  const turnoId = req.params.id;

  // Actualizar el estado del turno a 'ausente'
  db.run("UPDATE Turnos SET estado = 'ausente' WHERE id = ?", [turnoId], function(err) {
    if (err) {
      console.error('Error al marcar ausente el turno:', err);
      return res.status(500).json({ error: 'Error al marcar ausente el turno' });
    }

    res.json({ 
      success: true, 
      message: 'Turno marcado como ausente exitosamente'
    });
  });
});

// Ruta para obtener datos médicos
app.get('/api/medical-data', (req, res) => {
  const patientId = 1; // Assuming patient ID is 1 for now
  db.get('SELECT patientName, age, medicalHistory, id as turnoId FROM MedicalData WHERE patient_id = ?', [patientId], (err, row) => {
    if (err) {
      console.error('Error obteniendo datos médicos:', err);
      return res.status(500).json({ error: 'Error obteniendo datos médicos' });
    }

    if (!row) {
      return res.status(404).json({ message: 'Datos médicos no encontrados' });
    }

    res.json(row);
  });
});
// Nuevo endpoint para la pantalla de información
app.get('/api/pacientes', (req, res) => {
  // Obtener el paciente actual
  db.get("SELECT id, paciente_nombre, numero_turno FROM Turnos WHERE estado = 'atendiendo' ORDER BY fecha_creacion ASC LIMIT 1", (err, pacienteActual) => {
    if (err) {
      console.error('Error al buscar el paciente actual:', err);
      return res.status(500).json({ error: 'Error al buscar el paciente actual' });
    }

    // Obtener los próximos pacientes
    db.all("SELECT id, paciente_nombre, numero_turno FROM Turnos WHERE estado = 'espera' ORDER BY fecha_creacion ASC LIMIT 2", (err, proximosPacientes) => {
      if (err) {
        console.error('Error al buscar los próximos pacientes:', err);
        return res.status(500).json({ error: 'Error al buscar los próximos pacientes' });
      }

      // Formatear la respuesta
      const data = {
        actual: pacienteActual ? {
          numero: pacienteActual.numero_turno,
          nombre: pacienteActual.paciente_nombre
        } : null,
        proximos: proximosPacientes.map(paciente => ({
          numero: paciente.numero_turno,
          nombre: paciente.paciente_nombre
        }))
      };

      // Enviar la respuesta
      res.json(data);
    });
  });
});

process.on('uncaughtException', (err) => {
  console.error('Unhandled Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});