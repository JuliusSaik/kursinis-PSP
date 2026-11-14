import { GOOGLE_LOGIN_URL } from '../api.js';

const LOGIN_ERRORS = {
  google: 'Prisijungti per Google nepavyko. Bandykite dar kartą.',
  not_registered: 'Ši Google paskyra nėra užregistruota PiEmail sistemoje.',
};

export default function LoginPage({ session, loginError, onDemoLogin }) {
  return (
    <main className="login">
      <section>
        <h1>PiEmail</h1>
        <p className="muted">Svarbūs laiškai virsta priminimais Google Tasks.</p>

        {loginError && <p className="error">{LOGIN_ERRORS[loginError] ?? loginError}</p>}

        {session.googleLogin ? (
          <a className="button" href={GOOGLE_LOGIN_URL}>Prisijungti su Google</a>
        ) : (
          <p className="muted">Google prisijungimas nesukonfigūruotas (GOOGLE_CLIENT_ID).</p>
        )}

        {session.demoTenants.length > 0 && (
          <>
            <h2>Demonstraciniai klientai</h2>
            <p className="muted">Imituota pašto dėžutė ir užduotys, Google paskyros nereikia.</p>
            <div className="demo-tenants">
              {session.demoTenants.map((tenant) => (
                <button key={tenant.id} className="secondary" onClick={() => onDemoLogin(tenant.id)}>
                  {tenant.name}
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
