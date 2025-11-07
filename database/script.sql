CREATE DATABASE ProyectoDesarrolloWeb;
GO

USE ProyectoDesarrolloWeb;
GO

CREATE TABLE Usuarios (
    id INT PRIMARY KEY IDENTITY(1,1),
    email NVARCHAR(255) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    nombre NVARCHAR(100) NOT NULL,
    rol NVARCHAR(50) NOT NULL,
    activo BIT DEFAULT 1
);

CREATE TABLE Clinicas (
    id INT PRIMARY KEY IDENTITY(1,1),
    nombre NVARCHAR(100) NOT NULL,
    descripcion NVARCHAR(255),
    color NVARCHAR(10) DEFAULT '#007bff'
);

INSERT INTO Clinicas (nombre, descripcion) VALUES 
('Medicina General', 'Consulta de medicina general'),
('Pediatría', 'Atención para niños');

INSERT INTO Usuarios (email, password, nombre, rol) VALUES 
('enfermero@hospital.com', 'password', 'Ana López', 'enfermero'),
('medico@hospital.com', 'password', 'Dr. Carlos Ruiz', 'medico');
-- Tabla de Turnos (agregar esto al script existente)
CREATE TABLE Turnos (
    id INT PRIMARY KEY IDENTITY(1,1),
    paciente_id INT NOT NULL FOREIGN KEY REFERENCES Usuarios(id),
    clinica_id INT NOT NULL FOREIGN KEY REFERENCES Clinicas(id),
    numero_turno NVARCHAR(20) NOT NULL,
    estado NVARCHAR(20) DEFAULT 'espera',
    fecha_creacion DATETIME DEFAULT GETDATE(),
    fecha_llamado DATETIME NULL,
    fecha_atencion DATETIME NULL
);

CREATE TABLE MedicalData (
    id INT PRIMARY KEY IDENTITY(1,1),
    patient_id INT NOT NULL,
    patientName NVARCHAR(255),
    age INT,
    medicalHistory NVARCHAR(MAX)
);

INSERT INTO MedicalData (patient_id, patientName, age, medicalHistory)
VALUES (1, 'John Doe', 30, 'No known allergies');

CREATE TABLE Patients (
    id INT PRIMARY KEY IDENTITY(1,1),
    nombre NVARCHAR(100) NOT NULL,
    email NVARCHAR(255) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    clinica_id INT NOT NULL FOREIGN KEY REFERENCES Clinicas(id),
    fecha_registro DATETIME DEFAULT GETDATE()
);

CREATE TABLE Appointments (
    id INT PRIMARY KEY IDENTITY(1,1),
    patient_id INT NOT NULL FOREIGN KEY REFERENCES Patients(id),
    clinica_id INT NOT NULL FOREIGN KEY REFERENCES Clinicas(id),
    fecha DATETIME NOT NULL,
    hora TIME NOT NULL,
    estado NVARCHAR(20) DEFAULT 'scheduled'
);