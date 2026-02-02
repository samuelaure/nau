import React from 'react';
import { ArrowLeft, Shield, Lock, Eye, FileText, Scale } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack?: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div className="privacy-policy-container">
      <div className="privacy-content glass">
        <header className="privacy-header">
          {onBack && (
            <button onClick={onBack} className="back-btn">
              <ArrowLeft size={20} />
              <span>Volver</span>
            </button>
          )}
          <div className="logo small">
            whatsna<span>ŭ</span>
          </div>
          <h1>Política de Privacidad y Protección de Datos</h1>
          <p className="last-updated">Última actualización: 23 de enero de 2026</p>
        </header>

        <section className="privacy-intro">
          <p>
            En <strong>whatsnaŭ</strong>, la privacidad y seguridad de sus datos son nuestra máxima
            prioridad. Esta política detalla cómo recopilamos, usamos y protegemos la información en
            cumplimiento con el
            <strong>Reglamento General de Protección de Datos (RGPD)</strong> de la UE y la
            normativa española vigente (LOPDGDD).
          </p>
        </section>

        <div className="privacy-grid">
          <div className="privacy-section card">
            <div className="section-icon">
              <Shield className="primary-color" />
            </div>
            <h2>1. Responsable del Tratamiento</h2>
            <p>
              El responsable del tratamiento de los datos recogidos a través de esta plataforma es
              <strong> Samuel Aure ("whatsnaŭ")</strong>, con domicilio a efectos de notificaciones
              en España. Puede contactar con nuestro equipo de privacidad en:{' '}
              <a href="mailto:privacy@9nau.com">privacy@9nau.com</a>.
            </p>
          </div>

          <div className="privacy-section card">
            <div className="section-icon">
              <Eye className="primary-color" />
            </div>
            <h2>2. Finalidad del Tratamiento</h2>
            <p>Tratamos sus datos personales con las siguientes finalidades:</p>
            <ul>
              <li>Gestión de la cuenta de usuario y acceso al dashboard.</li>
              <li>Prestación de servicios de automatización de WhatsApp y CRM.</li>
              <li>Procesamiento de mensajes mediante modelos de Inteligencia Artificial.</li>
              <li>Soporte técnico y mejora de la plataforma.</li>
            </ul>
          </div>

          <div className="privacy-section card">
            <div className="section-icon">
              <Scale className="primary-color" />
            </div>
            <h2>3. Legitimación</h2>
            <p>La base legal para el tratamiento de su información es:</p>
            <ul>
              <li>
                <strong>Ejecución de un contrato:</strong> Para la prestación de los servicios
                solicitados.
              </li>
              <li>
                <strong>Interés legítimo:</strong> Para la seguridad de la red y la gestión
                administrativa.
              </li>
              <li>
                <strong>Consentimiento:</strong> Para el envío de comunicaciones comerciales o el
                uso de cookies no técnicas.
              </li>
            </ul>
          </div>

          <div className="privacy-section card">
            <div className="section-icon">
              <Lock className="primary-color" />
            </div>
            <h2>4. Destinatarios y Transferencias</h2>
            <p>
              Sus datos no se cederán a terceros, salvo obligación legal. Sin embargo, para la
              prestación del servicio utilizamos proveedores tecnológicos que pueden actuar como
              encargados del tratamiento:
            </p>
            <ul>
              <li>
                <strong>Meta Platforms, Inc.</strong> (WhatsApp Business API).
              </li>
              <li>
                <strong>OpenAI, LLC.</strong> (Procesamiento de IA - Datos anonimizados cuando es
                posible).
              </li>
              <li>
                <strong>Hetzner Online GmbH</strong> (Hospedaje de servidores en la UE).
              </li>
            </ul>
          </div>

          <div className="privacy-section card full-width">
            <div className="section-icon">
              <FileText className="primary-color" />
            </div>
            <h2>5. Sus Derechos (RGPD)</h2>
            <p>
              Como usuario, tiene derecho a ejercer sus derechos de{' '}
              <strong>
                acceso, rectificación, supresión, limitación del tratamiento, portabilidad y
                oposición
              </strong>
              . Para ello, envíe una comunicación escrita a
              <a href="mailto:privacy@9nau.com"> privacy@9nau.com</a> adjuntando copia de su DNI o
              documento equivalente para verificar su identidad.
            </p>
            <p>
              Asimismo, tiene derecho a retirar su consentimiento en cualquier momento y a reclamar
              ante la
              <strong> Agencia Española de Protección de Datos (AEPD)</strong> si considera que sus
              derechos han sido vulnerados.
            </p>
          </div>
        </div>

        <footer className="privacy-footer">
          <p>
            © 2026 whatsnaŭ. Comprometidos con la transparencia y la seguridad en España y la Unión
            Europea.
          </p>
        </footer>
      </div>
    </div>
  );
};
