import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { InteractiveAccordion } from '@elizabthpazp/intera-ui';
import { useOscuro } from './ui.jsx';
import { VERSION } from './api.js';

const PAGINAS = { privacidad: 'Política de privacidad', terminos: 'Términos de uso', propiedad: 'Propiedad intelectual', seguridad: 'Seguridad y datos', permisos: 'Permisos y consentimiento' };
export function PieLegal() {
  return <footer className="pie-legal no-imprimir">{Object.keys(PAGINAS).map((k) => <a key={k} href={`#/legal/${k}`}>{PAGINAS[k]}</a>)}<span>v{VERSION}</span></footer>;
}

export default function Legal({ pagina, empresa }) {
  const oscuro = useOscuro(), e = empresa || {}, E = e.nombre || 'la empresa', correo = e.correoDatos || 'el correo de contacto de la empresa';
  const resp = e.responsableDatos || 'el área de Gestión Humana';
  const C = {
    privacidad: <>
      <p>Esta política explica qué datos personales trata <strong>{E}</strong>{e.nit ? ` (NIT ${e.nit})` : ''} en la aplicación de control de jornada, para qué y con qué derechos cuenta usted. Se rige por la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y la Ley 1266 de 2008 en lo aplicable.</p>
      <h2>Responsable del tratamiento</h2>
      <p>{E}{e.direccion ? `, ${e.direccion}` : ''}{e.telefono ? `, tel. ${e.telefono}` : ''}. Canal para consultas y reclamos: <strong>{correo}</strong>, a cargo de {resp}.</p>
      <h2>Qué datos se tratan y para qué</h2>
      <table><thead><tr><th>Dato</th><th>Finalidad</th><th>Conservación</th></tr></thead><tbody>
        <tr><td>Cédula, nombre, cargo, correo, teléfono, EPS y ARL</td><td>Identificarlo y administrar la relación laboral</td><td>Mientras dure el vínculo y los plazos legales posteriores</td></tr>
        <tr><td>Salario</td><td>Liquidar y estimar su pago</td><td>Igual que los soportes de nómina</td></tr>
        <tr><td>Hora de entrada, salida y almuerzo</td><td>Cumplir el registro de jornada y de horas extra que exige la ley laboral</td><td>Mínimo el término de prescripción laboral (3 años)</td></tr>
        <tr><td>Ubicación (GPS) en el momento de marcar</td><td>Verificar que la marcación se hace en el centro de trabajo</td><td>Se borra automáticamente al cumplir el plazo configurado (por defecto 12 meses)</td></tr>
        <tr><td>Fotografía del rostro (dato sensible), solo en marcaciones al azar</td><td>Verificar que quien marca es usted</td><td>Se elimina automáticamente (por defecto a los 30 días)</td></tr>
        <tr><td>Permisos, incapacidades y sus soportes (pueden revelar datos de salud: dato sensible)</td><td>Justificar ausencias y liquidarlas correctamente</td><td>Igual que los soportes de nómina. No se registra el diagnóstico.</td></tr>
        <tr><td>Firma de quienes autorizan permisos</td><td>Dejar constancia de la autorización</td><td>Igual que el permiso</td></tr>
      </tbody></table>
      <p>La ubicación <strong>solo se toma en el instante de cada marcación</strong>. La aplicación no lo rastrea durante la jornada ni fuera de ella.</p>
      <h2>Datos sensibles</h2>
      <p>La fotografía del rostro y los datos relacionados con la salud son datos sensibles. Usted <strong>no está obligado a autorizar su tratamiento</strong>. Si no autoriza, no podrá marcar por la aplicación y {E} le ofrecerá un medio alterno de registro. La autorización se pide de forma expresa y separada, y queda guardada con fecha y versión de esta política.</p>
      <h2>Sus derechos</h2>
      <ul><li>Conocer, actualizar y rectificar sus datos.</li><li>Pedir prueba de la autorización que otorgó.</li><li>Saber qué uso se ha dado a sus datos.</li><li>Revocar la autorización o pedir la supresión cuando no exista un deber legal o contractual de conservarlos.</li><li>Presentar quejas ante la Superintendencia de Industria y Comercio, una vez agotado el reclamo ante {E}.</li></ul>
      <p>Escriba a {correo}. Las consultas se responden en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles (arts. 14 y 15 de la Ley 1581).</p>
      <h2>Quién más accede a los datos</h2>
      <p>Los datos se guardan en una hoja de cálculo y una carpeta de Google Drive propiedad de {E}, operadas con Google Apps Script (Google LLC actúa como encargado, con posible transmisión internacional). La página se publica en GitHub Pages, que solo entrega archivos de la aplicación y no recibe sus datos. Dentro de {E} acceden únicamente los administradores autorizados. Si la empresa activa las alertas por Telegram, los avisos de novedades (tipo de novedad, hora y lugar; el nombre solo si la empresa lo habilita) se envían a un grupo de Telegram que la empresa administra; Telegram guarda la información fuera de Colombia y actúa como encargado adicional (Ley 1581 art. 26). No se venden ni se ceden datos a terceros.</p>
      <h2>Vigencia</h2><p>Si la política cambia, la aplicación le pedirá autorizar de nuevo antes de seguir marcando.</p>
    </>,
    terminos: <>
      <p>Al usar esta aplicación usted acepta estas condiciones, que complementan su contrato de trabajo y el reglamento interno de {E}.</p>
      <h2>Uso permitido</h2>
      <ul><li>La cuenta es personal. No comparta su contraseña ni marque por otra persona: hacerlo puede constituir falta disciplinaria.</li><li>Marque en el momento real en que inicia o termina su labor. Si olvida una marcación, use «Se me olvidó marcar» indicando la hora verdadera y el motivo; queda sujeta a revisión.</li><li>No altere la ubicación del dispositivo ni use herramientas para simularla.</li></ul>
      <h2>Valor de la información</h2>
      <p>Las horas y los valores que muestra la pantalla principal son <strong>estimados</strong> con base en sus marcaciones y en la normativa laboral vigente (Código Sustantivo del Trabajo, Ley 2101 de 2021 y Ley 2466 de 2025). El valor definitivo es el del desprendible de nómina emitido por {E} al cerrar el periodo.</p>
      <p>Las horas extra solo se pagan cuando han sido autorizadas por {E}. Los permisos solo producen efecto cuando figuran como «Aprobado».</p>
      <h2>Disponibilidad</h2>
      <p>La aplicación funciona sin conexión para marcar y envía los datos al recuperar la señal. {E} no garantiza disponibilidad continua; ante una falla, informe a su jefe inmediato y use el registro alterno.</p>
      <h2>Cambios</h2><p>{E} puede actualizar estos términos. Los cambios relevantes se informan en la aplicación.</p>
    </>,
    propiedad: <>
      <p>El software de esta aplicación (código, diseño, textos y base de datos) está protegido por la Ley 23 de 1982, la Decisión Andina 351 de 1993 y la Ley 1915 de 2018.</p>
      <h2>Titularidad</h2>
      <p>Titular de los derechos patrimoniales del software: <strong>{e.titularSoftware || 'el titular indicado en el archivo LICENCIA del proyecto'}</strong>. {E} lo usa bajo licencia. No se permite copiar, modificar, descompilar ni redistribuir la aplicación sin autorización escrita del titular.</p>
      <h2>Marcas y contenidos de la empresa</h2><p>El nombre, el logotipo y los formatos internos de {E} le pertenecen a {E} y se usan aquí solo para identificar el servicio.</p>
      <h2>Datos</h2><p>Los datos de los trabajadores no son objeto de propiedad intelectual de terceros: pertenecen a sus titulares y son tratados por {E} según la política de privacidad.</p>
      <h2>Componentes de terceros</h2>
      <table><thead><tr><th>Componente</th><th>Licencia</th></tr></thead><tbody>
        <tr><td>React y React DOM</td><td>MIT</td></tr><tr><td>InteraUI (@elizabthpazp/intera-ui)</td><td>MIT</td></tr><tr><td>Framer Motion</td><td>MIT</td></tr><tr><td>Lucide (iconos)</td><td>ISC</td></tr><tr><td>SheetJS (exportación a Excel)</td><td>Apache 2.0</td></tr><tr><td>Tipografías Archivo y Public Sans</td><td>SIL Open Font License 1.1</td></tr>
      </tbody></table>
    </>,
    seguridad: <>
      <p>Resumen de las medidas con las que se protege la información.</p>
      <h2>Acceso</h2>
      <ul><li>Cada cuenta se activa con un código de un solo uso entregado por el administrador: nadie puede apropiarse de la cédula de otra persona.</li><li>Las contraseñas y las claves de firma se guardan cifradas de forma irreversible (hash con sal). Ni el administrador puede verlas.</li><li>Los intentos fallidos se limitan para impedir adivinar contraseñas o códigos.</li><li>Al desactivar a una persona, sus sesiones se cierran de inmediato.</li></ul>
      <h2>Integridad</h2>
      <ul><li>Un permiso solo queda aprobado con la firma de cada jefe (protegida con su clave personal) y, si la empresa lo configura, con la aprobación final del administrador.</li><li>Toda corrección de marcaciones, aprobación y cambio de configuración queda en un registro de auditoría con fecha y autor.</li><li>Un periodo de nómina cerrado no se puede modificar.</li></ul>
      <h2>Datos</h2>
      <ul><li>La comunicación viaja cifrada (HTTPS).</li><li>Las fotos se comprimen en su celular antes de enviarse y se guardan en una carpeta privada de la empresa.</li><li>Fotos y coordenadas se borran automáticamente al cumplir el plazo de conservación, sin depender de que alguien lo haga a mano.</li><li>Se hace copia de seguridad periódica y automática de toda la información.</li></ul>
      <h2>Monitoreo e incidentes</h2>
      <p>Los errores de la aplicación se registran y el administrador recibe alertas. Si ocurre un incidente que afecte datos personales, {E} lo reportará a la Superintendencia de Industria y Comercio dentro de los 15 días hábiles siguientes y avisará a los afectados.</p>
      <p>Para reportar una vulnerabilidad escriba a {correo}.</p>
    </>,
    permisos: <>
      <p>La aplicación pide permisos a su celular. Aquí se explica cada uno y qué pasa si no lo concede.</p>
      <div className="acordeon"><InteractiveAccordion darkMode={oscuro} items={[
        { id: 'gps', title: 'Ubicación: obligatoria para marcar', content: 'Se usa únicamente en el instante en que usted marca, para comprobar que está en el centro de trabajo. No hay seguimiento continuo. Si la bloquea, la aplicación no deja registrar la marcación y el administrador recibe un aviso.' },
        { id: 'cam', title: 'Cámara: algunas marcaciones, al azar', content: 'De forma aleatoria se pide una foto de su rostro para confirmar que quien marca es usted. La foto se toma en el momento (no se puede elegir de la galería), se comprime en su celular y se elimina automáticamente al cumplir el plazo de conservación. Si cancela la foto, esa marcación no se registra.' },
        { id: 'not', title: 'Notificaciones: opcionales', content: 'Sirven para recordarle marcar: 5 minutos antes de iniciar, 5 minutos después de la hora de salida y lo mismo en el almuerzo. Puede desactivarlas cuando quiera desde los ajustes de su celular.' },
        { id: 'alm', title: 'Almacenamiento en el celular', content: 'Se guarda su sesión para que no tenga que ingresar cada vez, y las marcaciones hechas sin señal hasta que puedan enviarse. Al cerrar sesión se borra.' },
        { id: 'rev', title: 'Cómo retirar un permiso o su autorización', content: 'En Android: mantenga presionado el ícono de la aplicación → Información → Permisos. En iPhone: Ajustes → Safari o la aplicación instalada → Ubicación / Cámara. Para revocar la autorización de tratamiento de datos escriba al canal indicado en la política de privacidad.' }
      ]} /></div>
      <h2>Cómo queda su consentimiento</h2>
      <p>Al crear su cuenta usted marca dos autorizaciones separadas: una para sus datos personales y otra, expresa, para datos sensibles (foto y ubicación). Se guardan la fecha, la hora y la versión de la política que aceptó. Si la política cambia, se le pedirá autorizar de nuevo.</p>
    </>
  };
  const p = PAGINAS[pagina] ? pagina : 'privacidad';
  return <main className="lectura" id="contenido">
    <a className="btn texto no-imprimir" href="#/" style={{ marginLeft: -12 }}><ArrowLeft size={18} aria-hidden="true" />Volver</a>
    <h1>{PAGINAS[p]}</h1><p className="suave chico">{E} · Versión vigente a noviembre de 2026</p>
    {C[p]}
    <p className="suave chico" style={{ marginTop: 32 }}>Texto modelo: debe ser revisado y adoptado por {E} con su asesor jurídico antes de ponerlo en uso.</p>
    <PieLegal />
  </main>;
}
