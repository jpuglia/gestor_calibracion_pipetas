/**
 * Inventory component for listing and filtering pipettes.
 * Provides search and status filtering capabilities to manage the pipette collection.
 */

import './Inventory.css';

import { Filter, Info, Plus, Search } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { pipetteService } from '../services/api';
import type { Pipette } from '../types';

const Inventory: React.FC = () => {
  const [pipettes, setPipettes] = useState<Pipette[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    const fetchPipettes = async () => {
      try {
        const data = await pipetteService.getAll();
        setPipettes(data);
      } catch (error) {
        console.error('Error fetching pipettes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPipettes();
  }, []);

  const filteredPipettes = pipettes.filter((p) => {
    const matchesSearch =
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.serial_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColorClass = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'active' || s === 'en uso') return 'green';
    if (s === 'decommissioned' || s === 'fuera de uso') return 'red';
    if (s === 'in calibration' || s === 'en reparación') return 'yellow';
    return 'grey';
  };

  return (
    <div className="inventory-page">
      <div className="page-header">
        <div className="header-title-row">
          <h2>Inventario de Pipetas</h2>
          <Link to="/pipette/new" className="btn-add-new">
            <Plus size={18} />
            <span>Registrar Pipeta</span>
          </Link>
        </div>
        <div className="controls">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar por código, descripción o serie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-box">
            <Filter size={18} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">Todos los estados</option>
              <option value="Active">Activa</option>
              <option value="In Calibration">En Calibración</option>
              <option value="Decommissioned">Fuera de Servicio</option>
              <option value="En uso">En uso (Legacy)</option>
              <option value="Fuera de uso">Fuera de uso (Legacy)</option>
              <option value="En reparación">En reparación (Legacy)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Cargando pipetas...</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>N° Serie</th>
                <th>Vol. Máx (µL)</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {filteredPipettes.map((p) => (
                <tr key={p.id}>
                  <td className="bold">{p.codigo}</td>
                  <td>{p.description}</td>
                  <td>{p.brand}</td>
                  <td>{p.model}</td>
                  <td>{p.serial_number}</td>
                  <td>{p.max_volume}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span
                      className={`status-dot ${getStatusColorClass(p.status)}`}
                      title={p.status}
                    />
                  </td>
                  <td>
                    <Link
                      to={`/pipette/${p.id}`}
                      className="btn-icon"
                      title="Ver detalles"
                    >
                      <Info size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Inventory;
