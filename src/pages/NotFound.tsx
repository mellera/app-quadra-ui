import { Link } from 'react-router-dom'
import { Page } from '../components/Common'

export function NotFound() {
  return <Page title="Pagina non trovata"><p>La pagina che cerchi non esiste. <Link to="/"><u>Torna alla Home</u></Link></p></Page>
}
