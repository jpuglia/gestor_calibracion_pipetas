/**
 * Dashboard component displaying key metrics and expiration alerts.
 * Visualizes the calibration status of the pipette inventory using a pie chart.
 */

import './Dashboard.css';

import { AlertTriangle, CheckCircle, Clock, Package } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { dashboardService } from '../services/api';
import type { DashboardStats, ExpirationAlert } from '../types';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<ExpirationAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, alertsData] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getAlerts(),
        ]);
        console.log('Dashboard stats:', statsData);
        console.log('Dashboard alerts:', alertsData);
        setStats(statsData);
        setAlerts(Array.isArray(alertsData) ? alertsData : []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading">Cargando dashboard...</div>;

  const totalPipettes = stats?.total_pipettes ?? 0;
  const expiringSoon = stats?.expiring_soon ?? 0;
  const totalEvents = stats?.total_events ?? 0;

  const pieData = [
    { name: 'Vencidas/Próximas', value: expiringSoon },
    { name: 'Al día', value: Math.max(0, totalPipettes - expiringSoon) },
  ];

  const COLORS = ['#ef4444', '#10b981'];

  return (
    <div className="dashboard-page">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Package size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Pipetas</span>
            <span className="stat-value">{totalPipettes}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Servicios Realizados</span>
            <span className="stat-value">{totalEvents}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Próximos Vencimientos</span>
            <span className="stat-value">{expiringSoon}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Días para Alerta</span>
            <span className="stat-value">30</span>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-container">
          <h3>Estado de Calibraciones</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            <span className="legend-item">
              <span className="dot red"></span> Vencidas/Próximas
            </span>
            <span className="legend-item">
              <span className="dot green"></span> Al día
            </span>
          </div>
        </div>

        <div className="alerts-container">
          <h3>Alertas de Vencimiento</h3>
          {alerts.length === 0 ? (
            <p className="no-alerts">No hay vencimientos próximos.</p>
          ) : (
            <ul className="alerts-list">
              {alerts.map((alert) => (
                <li key={alert.pipette_id} className="alert-item">
                  <div className="alert-header">
                    <span className="alert-code">{alert.pipette_codigo}</span>
                    <span
                      className={`alert-days ${alert.days_left < 0 ? 'expired' : ''}`}
                    >
                      {alert.days_left < 0
                        ? 'Vencida'
                        : `${alert.days_left} días restantes`}
                    </span>
                  </div>
                  <div className="alert-footer">
                    <span>{alert.type_event}</span>
                    <span>{alert.expiration_date}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
