import React, { useEffect, useRef, useState } from 'react'
import {
  BurritoProvider,
  vars,
} from '@janeapp/burrito-design-system'
import { JaneNavBar } from '../../jane-nav/src/components/JaneNavBar'

const NAV_ITEMS = [
  { label: 'Day' },
  { label: 'Schedule' },
  { label: 'Patients' },
  { label: 'Staff' },
  { label: 'Billing' },
  { label: 'Reports' },
  { label: 'Settings' },
]

/* ─────────────────────────────────────────────────────────────────
 *  Constants
 * ───────────────────────────────────────────────────────────────── */

const BASE_DATE = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
const HOUR_START = 8
const HOUR_END = 18
const SHIFT_START = 9
const SHIFT_END = 16
const ROW_HEIGHT = 56 // px per hour
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)

const TREATMENTS = [
  { id: '30m', label: '30 Minute Massage', duration: 0.5,  price: 60 },
  { id: '45m', label: '45 Minute Massage', duration: 0.75, price: 75 },
  { id: '60m', label: '60 Minute Massage', duration: 1.0,  price: 90 },
  { id: '90m', label: '90 Minute Massage', duration: 1.5,  price: 120 },
]

const MOCK_PATIENTS = [
  'Madison Barnaby', 'Marcus Gregory', 'Maya Chen', 'Michael Torres',
  'Zoe Gagnon', 'Aubrey French', 'Eva Mackay', 'Beatrice Clark',
  'Dylan Grewal', 'Samuel Clark', 'Owen Anderson', 'Lily Smith',
]

// Mock patient details shown after selection
const MOCK_PATIENT_INFO: Record<string, { email: string; phone: string; mobile: string; dob: string; upcomingAppts: number; creditCard: string; lastVisit: string; accountBalance: string; noShows: number }> = {
  'Madison Barnaby': { email: 'madison.barnaby@example.com', phone: '(604) 555-0192', mobile: '+1 778 234 5678', dob: 'March 14, 1988', upcomingAppts: 3, creditCard: 'Visa ending 4242', lastVisit: 'July 10, 2026 - 60 Minute Massage with Susan Lo', accountBalance: '$0.00', noShows: 0 },
  'Maya Chen':       { email: 'maya.chen@example.com',       phone: '(604) 555-0134', mobile: '+1 778 901 2345', dob: 'August 22, 1992',    upcomingAppts: 8,  creditCard: 'Visa ending 7891', lastVisit: 'July 8, 2026 - 60 Minute Massage with Susan Lo',   accountBalance: '$0.00', noShows: 0 },
  'Samuel Clark':    { email: 'samuel.clark@example.com',    phone: '(604) 555-0178', mobile: '+1 604 456 7890', dob: 'November 3, 1979',    upcomingAppts: 12, creditCard: 'No credit card on file', lastVisit: 'July 15, 2026 - 45 Minute Massage with Susan Lo', accountBalance: '$20.00', noShows: 1 },
}
const DEFAULT_PATIENT_INFO = { email: 'patient@example.com', phone: '(604) 555-0100', mobile: '+1 604 555 0101', dob: 'January 1, 1985', upcomingAppts: 2, creditCard: 'No credit card on file', lastVisit: 'July 1, 2026 - 60 Minute Massage with Susan Lo', accountBalance: '$0.00', noShows: 0 }

// Pre-booked appointments [slot → {patient, treatment}]
const BOOKED_TODAY: Record<string, { patient: string; treatment: string }> = {
  '10:00': { patient: 'Maya Chen',      treatment: '60 Minute Massage' },
  '13:00': { patient: 'Samuel Clark', treatment: '45 Minute Massage' },
}

/* ─────────────────────────────────────────────────────────────────
 *  Date helpers
 * ───────────────────────────────────────────────────────────────── */

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatHour(h: number): string {
  const whole = Math.floor(h)
  const frac = Math.round((h % 1) * 60)
  const min = String(frac).padStart(2, '0')
  const ampm = whole >= 12 ? 'PM' : 'AM'
  const display = whole > 12 ? whole - 12 : whole === 0 ? 12 : whole
  return `${display}:${min} ${ampm}`
}

function formatDay(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatDayShort(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

function slotToHour(slot: string): number {
  const [h, m] = slot.split(':').map(Number)
  return h + m / 60
}

function durationHours(label: string): number {
  return TREATMENTS.find(t => t.label === label)?.duration ?? 0.5
}

/* ─────────────────────────────────────────────────────────────────
 *  Focus trap hook
 * ───────────────────────────────────────────────────────────────── */

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return

    function nodes() {
      return Array.from(el!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        n => !n.closest('[hidden]') && !n.closest('[aria-hidden="true"]')
      )
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const all = nodes()
      if (!all.length) return
      const first = all[0], last = all[all.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first || !el!.contains(document.activeElement)) {
          e.preventDefault(); last.focus()
        }
      } else {
        if (document.activeElement === last || !el!.contains(document.activeElement)) {
          e.preventDefault(); first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, ref])
}

/* ─────────────────────────────────────────────────────────────────
 *  Visually-hidden utility
 * ───────────────────────────────────────────────────────────────── */

const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap',
}

/* ─────────────────────────────────────────────────────────────────
 *  Overlap Toast
 * ───────────────────────────────────────────────────────────────── */

function OverlapToast({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const toastBase: React.CSSProperties = {
    position: 'fixed', top: 20,
    background: '#b91c1c', color: '#fff',
    borderRadius: 8, padding: '12px 16px',
    fontSize: 14, fontWeight: 500,
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    zIndex: 600,
    display: 'flex', alignItems: 'center', gap: 10,
  }

  return (
    <>
      {/* Centre toast — "We could not book this appointment" */}
      <div
        role="alert"
        aria-atomic="true"
        style={{ ...toastBase, left: '50%', transform: 'translateX(-50%)', maxWidth: 420 }}
      >
        <span aria-hidden="true" style={{ fontSize: 18, flexShrink: 0 }}>⊘</span>
        <span>We could not book this appointment.</span>
      </div>

      {/* Right toast — "Overlapping appointments are disabled" */}
      <div
        role="alert"
        aria-atomic="true"
        aria-label="Overlapping appointments are disabled. The appointment panel will close automatically."
        style={{ ...toastBase, right: 20, maxWidth: 380 }}
      >
        <span aria-hidden="true" style={{ fontSize: 18, flexShrink: 0 }}>⊘</span>
        <span style={{ flex: 1 }}>Overlapping appointments are disabled.</span>
        <button
          aria-label="Dismiss"
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, padding: '0 0 0 8px', lineHeight: 1, flexShrink: 0 }}
        >×</button>
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────────
 *  Booking Panel
 * ───────────────────────────────────────────────────────────────── */

interface BookingPanelProps {

  practitioner: string
  startHour: number
  availableUntil: number
  date: Date
  bookedRanges: { start: number; end: number }[]
  onClose: () => void
  onBook: (result: { patient: string; treatment: string; startHour: number; endHour: number }) => void
  onOverlapClose: () => void
  onOverlap: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

function BookingPanel({
  practitioner, startHour, availableUntil, date, bookedRanges,
  onClose, onBook, onOverlapClose, onOverlap, triggerRef,
}: BookingPanelProps) {
  const TEAL = vars.global.color.brand['70']
  const [treatment, setTreatment] = useState('')
  const [selectedTime, setSelectedTime] = useState(startHour)
  const [patientQuery, setPatientQuery] = useState('')
  const [patient, setPatient] = useState('')
  const [notes, setNotes] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [overlapError, setOverlapError] = useState(false)

  const [insuranceChoice, setInsuranceChoice] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ treatment?: string; patient?: string; insurance?: string }>({})

  const panelRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const treatmentRef = useRef<HTMLSelectElement>(null)
  const packagesRef = useRef<HTMLDivElement>(null)
  const patientInfoRef = useRef<HTMLDivElement>(null)
  const focusSinkRef = useRef<HTMLDivElement>(null)

  // Build time options in 15-min increments from startHour up to (but not including) availableUntil
  const timeOptions: number[] = []
  for (let t = startHour; t < availableUntil; t += 0.25) timeOptions.push(t)

  const eligibleTreatments = TREATMENTS
  const selectedTreatment = TREATMENTS.find(t => t.id === treatment)
  const endHour = selectedTreatment ? selectedTime + selectedTreatment.duration : null

  const patientMatches = !patient && patientQuery.length >= 2
    ? MOCK_PATIENTS.filter(n => n.toLowerCase().includes(patientQuery.toLowerCase()))
    : []

  function hasOverlap(start: number, dur: number) {
    const end = start + dur
    return bookedRanges.some(r => start < r.end && end > r.start && !(start >= r.start && start < r.end))
  }

  // Auto-focus heading on open.
  // Double-RAF handles mouse clicks; the 50ms timeout handles Enter-key activation
  // (browser re-focuses the triggering button after keydown, so we must wait it out).
  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => headingRef.current?.focus())
    })
    const t = setTimeout(() => headingRef.current?.focus(), 50)
    return () => { cancelAnimationFrame(raf); clearTimeout(t) }
  }, [])

  // Escape closes panel unless overlap error is showing
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !overlapError) onClose()
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose, overlapError])

  // Return focus to the triggering slot button only on actual unmount — not on every re-render.
  // Keeping this separate prevents the inline onClose reference from firing this prematurely.
  useEffect(() => {
    const trigger = triggerRef
    return () => { trigger.current?.focus() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFocusTrap(panelRef, true)

  function selectPatient(name: string) {
    // Move focus to patient info card after selection
    setTimeout(() => (patientInfoRef.current as unknown as HTMLElement)?.focus(), 50)
    setPatient(name)
    setPatientQuery(name)
    const info = MOCK_PATIENT_INFO[name] ?? DEFAULT_PATIENT_INFO
    const label = `${name}. Email ${info.email}. Phone ${info.phone}. Mobile ${info.mobile}. Born ${info.dob}. ${info.upcomingAppts} upcoming appointments. ${info.creditCard}. Last visit ${info.lastVisit}. Account balance ${info.accountBalance}.`
    announce(label)
  }

  function announce(msg: string) {
    setAnnouncement('')
    setTimeout(() => setAnnouncement(msg), 50)
  }

  function handleTreatmentChange(id: string) {
    setTreatment(id)
    setOverlapError(false)
    const tr = TREATMENTS.find(t => t.id === id)
    if (!tr) return

    if (hasOverlap(selectedTime, tr.duration)) {
      announce(`Warning: ${tr.label} will overlap ${practitioner}'s next appointment.`)
    } else {
      announce(`${tr.label} selected. Duration: ${Math.round(tr.duration * 60)} minutes.`)
    }
  }

  const patientSearchRef = useRef<HTMLInputElement>(null)
  const insuranceRef = useRef<HTMLFieldSetElement>(null)

  function handleBook() {
    // Check overlap first — close panel and let DayView announce + show toast
    if (selectedTreatment && hasOverlap(selectedTime, selectedTreatment.duration)) {
      onOverlap()
      return
    }

    // Then validate required fields
    const errors: typeof fieldErrors = {}
    // Only show session error if sessions are available but user skipped selecting one
    if (!treatment && eligibleTreatments.length > 0) errors.treatment = 'Please select a session before completing booking'
    if (!patient)   errors.patient   = 'Please select a client before completing booking'
    if (!insuranceChoice) errors.insurance = 'Please select an insurance option before completing booking'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      announce(Object.values(errors).join('. '))
      if (errors.treatment) treatmentRef.current?.focus()
      else if (errors.patient) patientSearchRef.current?.focus()
      else if (errors.insurance) insuranceRef.current?.querySelector<HTMLElement>('input')?.focus()
      return
    }
    onBook({
      patient,
      treatment: selectedTreatment!.label,
      startHour: selectedTime,
      endHour: selectedTime + selectedTreatment!.duration,
    })
  }

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <>
      {/* Silent focus sink — captures focus when suggestion <li> disappears, preventing NVDA from falling to <body> */}
      <div ref={focusSinkRef} tabIndex={-1} style={srOnly} />

      {/* Always-rendered live region */}
      <div role="status" aria-live="polite" aria-atomic="true" style={srOnly}>
        {announcement}
      </div>

      {overlapError && <OverlapToast onDismiss={onOverlapClose} />}

      <div
        ref={panelRef}
        aria-describedby="booking-panel-desc"
        onKeyDown={e => {
          if (overlapError && e.key === 'Tab') {
            e.preventDefault()
            onOverlapClose()
          }
        }}
        style={{
          width: 350, flexShrink: 0,
          background: 'transparent',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Title row — no background, sits on gray */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 10px' }}>
          <button
            id="booking-panel-title"
            ref={headingRef as unknown as React.RefObject<HTMLButtonElement>}
            aria-roledescription={"\u200B"}
            aria-label="New Appointment"
            style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a1a', borderRadius: 4, background: 'none', border: 'none', padding: 0, cursor: 'default', fontFamily: 'inherit', textAlign: 'left' }}
          >
            <span aria-hidden="true">New Appointment</span>
          </button>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              background: '#e8e8e8', border: 'none',
              borderRadius: 6, width: 32, height: 32,
              cursor: 'pointer', fontSize: 15, color: '#555',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >✕</button>
        </div>

        {/* Booking Info bar — no background, sits on gray */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 12px', flexShrink: 0 }}>
          <div
            tabIndex={0}
            role="group"
            aria-roledescription={"\u200B"}
            aria-label="Booking Info"
            style={{ margin: 0, fontSize: 20, color: '#555', fontWeight: 600, borderRadius: 4 }}
          >
            <span aria-hidden="true">Booking Info</span>
          </div>
          <button
            aria-label="Book appointment"
            tabIndex={-1}
            onClick={handleBook}
            style={{
              background: TEAL, color: '#fff', border: 'none',
              borderRadius: 6, padding: '9px 18px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Book Appointment
          </button>
        </div>

        <p id="booking-panel-desc" style={srOnly}>{practitioner}, {dateLabel}, starting at {formatHour(startHour)}</p>

        {/* White card from Session onward */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #dde0e4', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {/* Sections */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* Session */}
          <div style={{ padding: '14px 16px', }}>
            <label htmlFor="treatment-select" style={{ display: 'block', margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: '#444' }}>Session</label>
            <select
              id="treatment-select"
              ref={treatmentRef}
              value={treatment}
              aria-roledescription="dropdown"
              aria-invalid={!!fieldErrors.treatment}
              aria-describedby={fieldErrors.treatment ? 'error-treatment' : undefined}
              onChange={e => { handleTreatmentChange(e.target.value); setFieldErrors(prev => ({ ...prev, treatment: undefined })) }}
              style={{
                width: '100%', padding: '10px 12px',
                border: fieldErrors.treatment ? '2px solid #c00' : '1px solid #ddd', borderRadius: 8,
                fontSize: 14, color: treatment ? '#222' : '#999',
                background: '#fff', fontFamily: 'inherit', cursor: 'pointer',
                appearance: 'auto',
              }}
            >
              <option value="">Select a session...</option>
              {eligibleTreatments.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            {eligibleTreatments.length === 0 && (
              <p role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#c00' }}>No sessions fit this time slot.</p>
            )}
            {fieldErrors.treatment && (
              <p id="error-treatment" role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#c00', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span aria-hidden="true">⚠</span>{fieldErrors.treatment}
              </p>
            )}
          </div>

          {/* Client */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #ebebeb', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#444' }}>Client</p>
              <button
                type="button"
                onClick={() => { setPatient('New Patient'); setPatientQuery('') }}
                style={{ fontSize: 13, padding: '4px 12px', border: '1px solid #ccc', borderRadius: 20, background: '#fff', cursor: 'pointer', color: '#333', fontFamily: 'inherit' }}
              >
                New Client
              </button>
            </div>
{/* Search UI — always visible */}
            <div aria-hidden="true">
                <label htmlFor="patient-search" style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Add Client</label>
                <div style={{ position: 'relative' }}>
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#aaa', pointerEvents: 'none' }}>
                    <circle cx="6" cy="6" r="4.5" stroke="#aaa" strokeWidth="1.5"/>
                    <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <input
                    id="patient-search"
                    ref={patientSearchRef}
                    type="text"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-invalid={!!fieldErrors.patient}
                    aria-describedby={fieldErrors.patient ? 'error-patient' : undefined}
                    aria-controls={patientMatches.length > 0 ? 'patient-suggestions' : undefined}
                    aria-expanded={patientMatches.length > 0}
                    placeholder="Add Client..."
                    value={patientQuery}
                    onChange={e => { setPatientQuery(e.target.value); setPatient(''); setInsuranceChoice(''); setFieldErrors(prev => ({ ...prev, patient: undefined })) }}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown' && patientMatches.length) {
                        e.preventDefault()
                        document.querySelector<HTMLElement>('#patient-suggestions [role="option"]')?.focus()
                      }
                      if (e.key === 'Enter' && patientMatches.length === 1) {
                        e.preventDefault()
                        selectPatient(patientMatches[0])
                      }
                    }}
                    style={{ width: '100%', padding: '9px 32px 9px 32px', boxSizing: 'border-box', border: fieldErrors.patient ? '2px solid #c00' : '1px solid #ddd', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }}
                  />
                  {patientQuery && (
                    <button type="button" onClick={() => { setPatientQuery(''); setPatient(''); setInsuranceChoice('') }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 16, padding: 0, lineHeight: 1 }} aria-label="Clear client">✕</button>
                  )}
                </div>
                <ul
                    id="patient-suggestions"
                    role="listbox"
                    aria-label="Client suggestions"
                    aria-hidden="true"
                    style={{ display: patientMatches.length > 0 ? 'block' : 'none', position: 'absolute', left: 16, right: 16, zIndex: 200, background: '#fff', border: '1px solid #ccc', borderRadius: 6, marginTop: 2, padding: 0, listStyle: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto' }}
                  >
                    {patientMatches.map((name, idx) => (
                      <li
                        key={name}
                        role="option"
                        tabIndex={0}
                        aria-selected={false}
                        onClick={() => { selectPatient(name) }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPatient(name) }
                          else if (e.key === 'ArrowDown') { e.preventDefault(); document.querySelectorAll<HTMLElement>('#patient-suggestions [role="option"]')[idx + 1]?.focus() }
                          else if (e.key === 'ArrowUp') { e.preventDefault(); idx === 0 ? document.getElementById('patient-search')?.focus() : document.querySelectorAll<HTMLElement>('#patient-suggestions [role="option"]')[idx - 1]?.focus() }
                          else if (e.key === 'Escape') setPatientQuery('')
                        }}
                        style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 14, color: '#222' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0faf9')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                        onFocus={e => { e.currentTarget.style.background = '#f0faf9'; e.currentTarget.style.outline = `2px solid ${TEAL}`; e.currentTarget.style.outlineOffset = '-2px' }}
                        onBlur={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.outline = 'none' }}
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                {patientQuery.length >= 2 && patientMatches.length === 0 && !patient && (
                  <p role="status" style={{ fontSize: 13, color: '#888', fontStyle: 'italic', margin: '6px 0 0' }}>No clients found for "{patientQuery}"</p>
                )}
                {!patient && patientQuery.length === 0 && (
                  <p style={{ fontSize: 13, color: '#aaa', fontStyle: 'italic', margin: '8px 0 0' }}>No client selected...</p>
                )}
                {fieldErrors.patient && (
                  <p id="error-patient" role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#c00', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span aria-hidden="true">⚠</span>{fieldErrors.patient}
                  </p>
                )}
            </div>{/* end search UI wrapper */}

            {/* Patient selected row — always block, height:0 when empty so NVDA sees no structural change */}
            <div style={{ height: patient ? 'auto' : 0, overflow: 'hidden', marginTop: patient ? 12 : 0 }}>
              {(() => {
                const info = MOCK_PATIENT_INFO[patient] ?? DEFAULT_PATIENT_INFO
                return (
                  <button
                    ref={patientInfoRef as unknown as React.RefObject<HTMLButtonElement>}
                    tabIndex={patient ? 0 : -1}
                    aria-roledescription={"\u200B"}
                    aria-label={`${patient}. Email ${info.email}. Phone ${info.phone}. Mobile ${info.mobile}. Born ${info.dob}. ${info.upcomingAppts} upcoming appointments. ${info.creditCard}. Last visit ${info.lastVisit}. Account balance ${info.accountBalance}.${info.noShows > 0 ? ` ${info.noShows} no show${info.noShows > 1 ? 's' : ''}.` : ''}`}
                    style={{ display: 'block', width: '100%', border: 'none', padding: 0, fontSize: 13, lineHeight: 1.6, color: '#333', background: 'transparent', cursor: 'default', fontFamily: 'inherit', textAlign: 'left' }}
                  >
                    <div style={{ marginBottom: 4 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#1a1a1a' }} aria-hidden="true">{patient}</p>
                    </div>
                    <p style={{ margin: '0 0 4px', display: 'none' }} aria-hidden="true">{patient}</p>
                    <p style={{ margin: '0 0 2px' }} aria-hidden="true"><span aria-hidden="true">✉ </span><span style={{ color: TEAL }}>{info.email}</span></p>
                    <p style={{ margin: '0 0 2px' }} aria-hidden="true"><span aria-hidden="true">⌂ </span>{info.phone} &nbsp; <span aria-hidden="true">☏ </span>{info.mobile}</p>
                    <p style={{ margin: '0 0 2px' }} aria-hidden="true"><span aria-hidden="true">🎁 </span>{info.dob}</p>
                    <p style={{ margin: '0 0 2px' }} aria-hidden="true"><span aria-hidden="true">📅 </span>{info.upcomingAppts} upcoming appointments</p>
                    <p style={{ margin: '0 0 8px' }} aria-hidden="true"><span aria-hidden="true">💳 </span>{info.creditCard}</p>
                    <p style={{ margin: '0 0 2px' }} aria-hidden="true"><strong>Last Visit</strong> {info.lastVisit}</p>
                    <p style={{ margin: '0 0 6px' }} aria-hidden="true"><strong>Account Balance</strong> {info.accountBalance}</p>
                    {info.noShows > 0 && (
                      <span aria-hidden="true" style={{ background: '#F5A623', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                        {info.noShows} No Show{info.noShows > 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                )
              })()}
            </div>
          </div>

          {/* Packages & Memberships */}
          <div
            ref={packagesRef}
            tabIndex={0}
            role="button"
            aria-roledescription={"\u200B"}
            aria-label="Packages and Memberships: No Packages/Memberships"
            style={{ padding: '14px 16px', borderRadius: 4 }}
          >
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#444' }}>Packages &amp; Memberships</p>
            <p style={{ margin: 0, fontSize: 14, color: '#555' }}>No Packages/Memberships</p>
          </div>

          {/* Insurance Info */}
          <fieldset
            ref={insuranceRef}
            aria-describedby={fieldErrors.insurance ? 'error-insurance' : undefined}
            style={{ margin: 0, padding: '14px 16px', border: fieldErrors.insurance ? '2px solid #c00' : 'none', borderRadius: fieldErrors.insurance ? 8 : 0 }}
          >
            <legend style={{ padding: 0, fontSize: 15, fontWeight: 600, color: '#444', marginBottom: 10 }}>Insurance Info</legend>
            {(() => {
              const opts = [
                { value: 'copy-previous', label: 'Copy Previous', sub: 'July 19, 2026 - 12:00pm, 30 Minute Return Visit (30 minutes) with Michael Carroll' },
                { value: 'add-policy',    label: 'Add Policy',    sub: 'Knee Injury - Manulife #7456' },
                { value: 'none',          label: 'None',          sub: '' },
              ]
              const selectInsurance = (val: string) => {
                setInsuranceChoice(val)
                setFieldErrors(prev => ({ ...prev, insurance: undefined }))
              }
              return opts.map((opt, idx) => {
                const isChecked = insuranceChoice === opt.value
                // Roving tabindex: only checked option (or first if none) is in tab order
                const isTabStop = insuranceChoice ? isChecked : idx === 0
                return (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, cursor: 'pointer', fontSize: 14, color: '#333' }}>
                    <input
                      type="radio"
                      name="insurance"
                      value={opt.value}
                      checked={isChecked}
                      tabIndex={isTabStop ? 0 : -1}
                      aria-label={isChecked ? `${opt.label}, selected` : opt.label}
                      onChange={() => selectInsurance(opt.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); selectInsurance(opt.value) }
                        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                          e.preventDefault()
                          const next = opts[(idx + 1) % opts.length]
                          selectInsurance(next.value)
                          insuranceRef.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]')[(idx + 1) % opts.length]?.focus()
                        }
                        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                          e.preventDefault()
                          const prev = opts[(idx - 1 + opts.length) % opts.length]
                          selectInsurance(prev.value)
                          insuranceRef.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]')[(idx - 1 + opts.length) % opts.length]?.focus()
                        }
                      }}
                      style={{ marginTop: 3, accentColor: TEAL, flexShrink: 0 }}
                    />
                    <span>
                      <span style={{ fontWeight: isChecked ? 600 : 400 }}>{opt.label}</span>
                      {opt.sub && <span style={{ display: 'block', fontSize: 13, color: '#777', marginTop: 2 }}>{opt.sub}</span>}
                    </span>
                  </label>
                )
              })
            })()}
            {fieldErrors.insurance && (
              <p id="error-insurance" role="alert" style={{ margin: '2px 0 0', fontSize: 13, color: '#c00', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span aria-hidden="true">⚠</span>{fieldErrors.insurance}
              </p>
            )}
          </fieldset>

          {/* Time */}
          <div style={{ padding: '14px 16px', }}>
            <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: '#444' }}>Time</p>
            <select
              aria-label="Start time"
              aria-roledescription="dropdown"
              value={String(selectedTime)}
              onChange={e => { setSelectedTime(Number(e.target.value)) }}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, background: '#fff', fontFamily: 'inherit', cursor: 'pointer', marginBottom: 8, appearance: 'auto' }}
            >
              {timeOptions.map(t => (
                <option key={t} value={String(t)}>{formatHour(t)}</option>
              ))}
            </select>
            <p style={{ margin: 0, fontSize: 14, color: '#333' }}>
              {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} {formatHour(selectedTime)}{endHour !== null ? ` - ${formatHour(endHour)}` : ''}
              {endHour === null && <span style={{ color: '#aaa' }}> - select a session</span>}
            </p>
          </div>

          {/* Staff Member */}
          <div
            tabIndex={0}
            aria-label={`Staff Member: ${practitioner}`}
            style={{ padding: '14px 16px', borderRadius: 4 }}
          >
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#444' }}>Staff Member</p>
            <p style={{ margin: 0, fontSize: 14, color: '#333' }}>{practitioner}</p>
          </div>

          {/* Resources */}
          <div
            tabIndex={0}
            aria-label="Resources: No resources required"
            style={{ padding: '14px 16px', borderRadius: 4 }}
          >
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#444' }}>Resources</p>
            <p style={{ margin: 0, fontSize: 14, color: '#555' }}>No resources required</p>
          </div>

          {/* Notes */}
          <div style={{ padding: '14px 16px' }}>
            <label aria-hidden="true" style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#444', marginBottom: 8 }}>Notes</label>
            <textarea
              aria-label="Notes. Write a note"
              aria-roledescription={"​"}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Write a note"
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', color: '#333' }}
            />
          </div>

        </div>

        {/* Footer — Book Appointment first in DOM (tabs first), Cancel second.
            CSS order flips visual layout: Cancel appears left, Book right. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid #ebebeb', background: '#fff', flexShrink: 0 }}>
          <button
            onClick={handleBook}
            aria-label="Book Appointment, press Enter to book"
            aria-roledescription={"\u200B"}
            style={{ order: 2, padding: '9px 20px', background: TEAL, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Book Appointment
          </button>
          <button
            onClick={onClose}
            style={{ order: 1, padding: '9px 20px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#444' }}
          >
            Cancel
          </button>
        </div>
        </div>{/* end white card */}

      </div>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────────
 *  Confirmed Appointment Panel
 * ───────────────────────────────────────────────────────────────── */

function SectionHeader({ label, expanded, onToggle }: { label: string; expanded: boolean; onToggle: () => void }) {
  const TEAL = vars.global.color.brand['70']
  return (
    <button
      onClick={onToggle}
      aria-expanded={expanded}
      style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: '12px 16px', cursor: 'pointer', fontFamily: 'inherit', borderTop: '1px solid #e8e8e8' }}
    >
      <span style={{ fontSize: 16, fontWeight: 600, color: TEAL }}>{label}</span>
      <span aria-hidden="true" style={{ fontSize: 12, color: TEAL }}>{expanded ? '▲' : '▼'}</span>
    </button>
  )
}

function ConfirmedPanel({
  patient, treatment, startHour, endHour, practitioner, date, onClose, onArrive,
}: {
  patient: string; treatment: string; startHour: number; endHour: number
  practitioner: string; date: Date; onClose: () => void; onArrive?: () => void
}) {
  const TEAL = vars.global.color.brand['70']
  const panelRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [expanded, setExpanded] = useState({ booking: true, notes: true, billing: true, insurance: true, returnVisit: true, history: true })
  const toggle = (key: keyof typeof expanded) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  const [arrived, setArrived] = useState(false)

  // Focus "Appointment" heading when panel opens — 150ms wins over NewAppointmentPanel unmount cleanup
  useEffect(() => {
    const t = setTimeout(() => headingRef.current?.focus(), 150)
    return () => clearTimeout(t)
  }, [])

  // Return focus to date header on close — separate effect so it only fires on unmount
  useEffect(() => {
    return () => {
      const el = document.querySelector<HTMLElement>('[data-date-header]')
      el?.focus()
    }
  }, [])

  useFocusTrap(panelRef, true)

  const info = MOCK_PATIENT_INFO[patient] ?? DEFAULT_PATIENT_INFO
  const apptPrice = TREATMENTS.find(t => t.label === treatment)?.price ?? 60
  const tax = Math.round(apptPrice * 0.05)
  const total = apptPrice + tax

  const dateShort = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const dateCompact = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const timeRange = `${formatHour(startHour)} - ${formatHour(endHour)}`
  const now = new Date()
  const bookedTime = now.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })

  return (
    <div style={{ padding: 12, background: '#f0f1f2', overflowY: 'auto', flexShrink: 0 }}>
      <div ref={panelRef} style={{ width: 350, background: '#fff', border: '1px solid #dde0e4', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #e8e8e8' }}>
          <button ref={headingRef as unknown as React.RefObject<HTMLButtonElement>} aria-roledescription={"\u200B"} aria-label="Appointment" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a1a', borderRadius: 4, background: 'none', border: 'none', padding: 0, cursor: 'default', fontFamily: 'inherit', textAlign: 'left' }}><span aria-hidden="true">Appointment</span></button>
          <button aria-label="Close appointment" onClick={onClose}
            style={{ background: '#f2f2f2', border: 'none', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', fontSize: 15, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid #e8e8e8' }}>
          <button
            aria-label={arrived ? 'Arrived, appointment marked as arrived' : 'Mark as Arrived'}
            aria-pressed={arrived}
            onClick={() => { setArrived(true); onArrive?.() }}
            style={{ padding: '7px 16px', border: arrived ? 'none' : '1px solid #ccc', borderRadius: 6, background: arrived ? '#8CC27F' : '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: arrived ? '#fff' : '#333' }}
          >Arrive</button>
          <button aria-label="Mark as No Show" style={{ padding: '7px 16px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#333' }}>No Show</button>
          <button disabled tabIndex={-1} aria-disabled="true" aria-label="Pay, currently unavailable" style={{ marginLeft: 'auto', padding: '7px 16px', border: '1px solid #ddd', borderRadius: 6, background: '#f5f5f5', fontSize: 13, fontWeight: 500, cursor: 'not-allowed', fontFamily: 'inherit', color: '#aaa' }}>Pay ▾</button>
        </div>

        {/* Arrived summary row */}
        {arrived && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #e8e8e8', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{patient}</span>
              <div style={{ color: TEAL, fontSize: 12, marginTop: 2 }}>MSP (British Columbia)</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>Owing: {info.accountBalance === '$0.00' ? '$0.00' : info.accountBalance}</div>
              <span style={{ background: '#333', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>No Submission Required</span>
            </div>
          </div>
        )}

        {/* Booking Info */}
        <SectionHeader label="Booking Info" expanded={expanded.booking} onToggle={() => toggle('booking')} />
        {expanded.booking && (
          <div style={{ padding: '12px 16px', fontSize: 13, color: '#333', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Patient + appointment details — one focusable container */}
            <div
              tabIndex={0}
              aria-label={`Client: ${patient}. Phone ${info.phone}. Mobile ${info.mobile}. Born ${info.dob}. Email ${info.email}. ${info.creditCard}. Account owing ${info.accountBalance}. Account credit $0.00. Appointment on ${dateShort} from ${timeRange} at The Village, Room 1. ${treatment} with ${practitioner}.`}
              style={{ border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}
            >
              {/* Patient card — hidden from screen reader, aria-label above covers it */}
              <div aria-hidden="true">
                <div style={{ padding: '10px 12px', lineHeight: 1.7, borderBottom: '1px solid #eee' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{patient}</p>
                  <p style={{ margin: 0 }}>⌂ {info.phone} &nbsp; ☏ {info.mobile}</p>
                  <p style={{ margin: 0 }}>🎁 {info.dob}</p>
                  <p style={{ margin: 0, color: TEAL }}>{info.email}</p>
                  <p style={{ margin: 0 }}>💳 {info.creditCard}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid #eee' }}>
                    <span>Account Owing</span><span>{info.accountBalance}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Account Credit</span><span>$0.00</span>
                  </div>
                </div>
                <div style={{ padding: '10px 12px', lineHeight: 1.8 }}>
                  <p style={{ margin: 0 }}>{dateShort}</p>
                  <p style={{ margin: 0 }}>{timeRange}</p>
                  <p style={{ margin: 0 }}>The Village</p>
                  <p style={{ margin: '0 0 6px' }}>Room 1</p>
                  <p style={{ margin: 0 }}>{practitioner}</p>
                </div>
              </div>
            </div>

            {/* Treatment row with Edit button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
              <span style={{ fontSize: 13, color: '#333' }}>{treatment} (${apptPrice}.00)</span>
              <button
                aria-label={`Edit ${treatment}`}
                style={{ background: 'none', border: '1px solid #ccc', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
                </svg>
              </button>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {['Copy', 'Move'].map(l => (
                <button key={l} style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#333' }}>{l}</button>
              ))}
              <button aria-label="Book Recurring Appointment" style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#333' }}>»</button>
              <button style={{ marginLeft: 'auto', padding: '6px 12px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#c00' }}>Cancel/Delete ▾</button>
            </div>
          </div>
        )}

        {/* Notes */}
        <SectionHeader label="Notes" expanded={expanded.notes} onToggle={() => toggle('notes')} />
        {expanded.notes && (
          <div style={{ padding: '12px 16px' }}>
            <textarea rows={3} placeholder="Add a note…" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', color: '#333' }} />
          </div>
        )}

        {/* Billing Info */}
        <SectionHeader label="Billing Info" expanded={expanded.billing} onToggle={() => toggle('billing')} />
        {expanded.billing && (
          <div
            tabIndex={0}
            aria-label={`Billing Info. Status: Uninvoiced. ${treatment} $${apptPrice}.00. No Packages/Memberships. Subtotal $${apptPrice}.00. Tax $${tax}.00. Total $${total}.00. Client total $${total}.00.`}
            style={{ padding: '12px 16px', fontSize: 13, color: '#333' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 600 }}>Status: Uninvoiced</span>
              <button tabIndex={-1} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEAL, fontSize: 13, fontFamily: 'inherit' }}>Add Item ⊕</button>
            </div>
            <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span style={{ fontWeight: 600 }}>{treatment}</span><span>${apptPrice}.00</span></div>
              <p style={{ margin: '0 0 8px', color: '#888' }}>No Packages/Memberships</p>
              <div style={{ borderTop: '1px solid #eee', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>${apptPrice}.00</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax</span><span>${tax}.00</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>Total</span><span>${total}.00</span></div>
              </div>
            </div>
            <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span>👤 {patient}</span>
                <span style={{ background: '#e8e8e8', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: '#666' }}>Uninvoiced</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>Total</span><span>${total}.00</span></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button tabIndex={-1} style={{ flex: 1, padding: '8px', background: TEAL, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Adjustment ⊕</button>
              <button tabIndex={-1} style={{ flex: 1, padding: '8px', background: TEAL, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>View ▶</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13, paddingTop: 6, borderTop: '1px solid #eee' }}>
              <span>Client Total</span><span>${total}.00</span>
            </div>
          </div>
        )}

        {/* Insurance Info */}
        <SectionHeader label="Insurance Info" expanded={expanded.insurance} onToggle={() => toggle('insurance')} />
        {expanded.insurance && (
          <div
            tabIndex={0}
            aria-label={`Insurance Info. ${dateCompact}, ${timeRange}, ${treatment}. Options: Copy Previous, Add Policy.`}
            style={{ padding: '12px 16px', fontSize: 13, color: '#555', display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <p style={{ margin: 0 }}>{dateCompact} - {timeRange}, {treatment}</p>
            <button tabIndex={-1} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: 6, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#333' }}>⎋ Copy Previous ▾</button>
            <button tabIndex={-1} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: 6, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#333' }}>⊕ Add Policy ▾</button>
          </div>
        )}

        {/* Return Visit Reminders */}
        <SectionHeader label="Return Visit Reminders" expanded={expanded.returnVisit} onToggle={() => toggle('returnVisit')} />
        {expanded.returnVisit && (
          <div
            tabIndex={0}
            aria-label={`Return Visit Reminders. ${patient} has ${info.upcomingAppts} upcoming appointments. Next visit: ${dateShort} ${formatHour(startHour)}, ${treatment} with ${practitioner}.`}
            style={{ padding: '12px 16px', fontSize: 13, color: '#333', display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <p style={{ margin: 0 }}>{patient} has <span style={{ color: TEAL, fontWeight: 600 }}>{info.upcomingAppts} upcoming appointments</span></p>
            <p style={{ margin: 0, color: '#555' }}>Next Visit: {dateShort} {formatHour(startHour)}<br />{treatment} with {practitioner}</p>
            <button tabIndex={-1} style={{ padding: '8px', background: TEAL, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Add Return Visit Reminder ▾</button>
          </div>
        )}

        {/* History & Status */}
        <SectionHeader label="History & Status" expanded={expanded.history} onToggle={() => toggle('history')} />
        {expanded.history && (
          <div style={{ padding: '12px 16px', fontSize: 13, color: '#333', display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #eee' }}>
                <p style={{ margin: 0, fontWeight: 700 }}>Status: {arrived ? 'Arrived' : 'Booked'}</p>
              </div>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #eee' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700 }}>Activity</p>
                {arrived && <p style={{ margin: '0 0 2px', color: '#555' }}>Arrived by Demo Owner on {bookedTime}</p>}
                <p style={{ margin: '0 0 2px', color: '#555' }}>Booked by Demo Owner on {bookedTime}</p>
              </div>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #eee' }}>
                <p style={{ margin: '0 0 2px', fontWeight: 700 }}>Reminders</p>
                <p style={{ margin: 0, color: '#777' }}>No reminders set for this appointment</p>
              </div>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #eee' }}>
                <p style={{ margin: '0 0 2px', fontWeight: 700 }}>Notifications</p>
                <p style={{ margin: 0, color: '#777' }}>No notifications set for this appointment</p>
              </div>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #eee' }}>
                <p style={{ margin: '0 0 2px', fontWeight: 700 }}>Clinical Surveys</p>
                <p style={{ margin: 0, color: '#777' }}>No clinical surveys set for this appointment</p>
              </div>
              <div style={{ padding: '10px 12px' }}>
                <button style={{ background: 'none', border: 'none', color: TEAL, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 0 }}>View Detailed History</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
 *  Day View
 * ───────────────────────────────────────────────────────────────── */

function DayView() {
  const TEAL = vars.global.color.brand['70']
  const practitioner = 'Susan Lo'

  const [dayOffset, setDayOffset] = useState(0)
  const [bookingHour, setBookingHour] = useState<number | null>(null)
  const [bookingAvailableUntil, setBookingAvailableUntil] = useState<number | null>(null)
  const [arrivedSlots, setArrivedSlots] = useState<Set<string>>(new Set())
  const [addedBookings, setAddedBookings] = useState<Record<string, { patient: string; treatment: string }>>({})
  const [confirmedAppt, setConfirmedAppt] = useState<{ patient: string; treatment: string; startHour: number; endHour: number } | null>(null)
  const [successAnnouncement, setSuccessAnnouncement] = useState('')
  const [overlapAnnouncement, setOverlapAnnouncement] = useState('')
  const [focusedRange, setFocusedRange] = useState<{ startHour: number; endHour: number } | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerYear, setPickerYear] = useState('')
  const [pickerMonth, setPickerMonth] = useState('')
  const [pickerDay, setPickerDay] = useState('')
  const [pickerAnnouncement, setPickerAnnouncement] = useState('')

  const dateHeaderRef = useRef<HTMLDivElement>(null)
  const activeSlotRef = useRef<HTMLButtonElement | null>(null)

  const currentDay = addDays(BASE_DATE, dayOffset)
  const isToday = dayOffset === 0

  const booked = { ...BOOKED_TODAY, ...addedBookings }

  const bookedRanges = Object.entries(booked).map(([slot, appt]) => {
    const start = slotToHour(slot)
    return { start, end: start + durationHours(appt.treatment) }
  })

  function handleSlotClick(hour: number, availableUntil: number) {
    setBookingHour(hour)
    setBookingAvailableUntil(availableUntil)
    setConfirmedAppt(null)
  }

  function handleBook(result: { patient: string; treatment: string; startHour: number; endHour: number }) {
    const slot = `${String(Math.floor(result.startHour)).padStart(2, '0')}:${String(Math.round((result.startHour % 1) * 60)).padStart(2, '0')}`
    setAddedBookings(prev => ({ ...prev, [slot]: { patient: result.patient, treatment: result.treatment } }))
    setConfirmedAppt(result)
    setBookingHour(null)
    setSuccessAnnouncement('')
    setTimeout(() => setSuccessAnnouncement('Appointment successfully booked.'), 100)
  }

  // Build grid items
  const sortedBooked = [...bookedRanges].sort((a, b) => a.start - b.start)

  type GridItem =
    | { kind: 'booked'; startHour: number; endHour: number; patient: string; treatment: string }
    | { kind: 'available'; startHour: number; endHour: number }

  const gridItems: GridItem[] = []
  for (const [slot, appt] of Object.entries(booked)) {
    const s = slotToHour(slot)
    gridItems.push({ kind: 'booked', startHour: s, endHour: s + durationHours(appt.treatment), patient: appt.patient, treatment: appt.treatment })
  }
  let cursor = HOUR_START
  for (const r of sortedBooked) {
    if (r.start > cursor) gridItems.push({ kind: 'available', startHour: cursor, endHour: r.start })
    cursor = Math.max(cursor, r.end)
  }
  if (cursor < HOUR_END) gridItems.push({ kind: 'available', startHour: cursor, endHour: HOUR_END })
  gridItems.sort((a, b) => a.startHour - b.startHour)

  const apptColors = ['#00C1CA', '#00C1CA', '#00C1CA']
  const bookedSlots = Object.keys(booked)
  const colorMap = bookedSlots.reduce((acc, slot, i) => { acc[slot] = i % apptColors.length; return acc }, {} as Record<string, number>)

  function navigateToDate() {
    if (!pickerYear || !pickerMonth || !pickerDay) return
    const picked = new Date(Number(pickerYear), Number(pickerMonth) - 1, Number(pickerDay))
    const diff = Math.round((picked.getTime() - BASE_DATE.getTime()) / 86400000)
    const label = picked.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    setPickerAnnouncement(`${label} selected.`)
    setTimeout(() => {
      setDayOffset(diff)
      setShowDatePicker(false)
      setTimeout(() => dateHeaderRef.current?.focus(), 100)
    }, 1500)
  }

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', background: '#f4f4f4', minHeight: 0 }}>

      {/* Always-rendered live regions — never toggled in/out so JAWS finds them */}
      <div role="status" aria-live="polite" aria-atomic="true" style={srOnly}>{successAnnouncement}</div>
      <div role="status" aria-live="polite" aria-atomic="true" style={srOnly} aria-hidden="true">{pickerAnnouncement}</div>
      <div role="alert" aria-live="assertive" aria-atomic="true" style={srOnly}>{overlapAnnouncement}</div>

      {/* Overlap toast — shown at app level so it persists after panel closes */}
      {overlapAnnouncement && (
        <div role="presentation" style={{ position: 'fixed', top: 20, right: 20, background: '#b91c1c', color: '#fff', borderRadius: 8, padding: '12px 16px', fontSize: 14, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 600, maxWidth: 380, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden="true" style={{ fontSize: 18, flexShrink: 0 }}>⊘</span>
          <span style={{ flex: 1 }}>Overlapping appointments are disabled.</span>
          <button aria-label="Dismiss" onClick={() => setOverlapAnnouncement('')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, padding: '0 0 0 8px', lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#f0f1f2' }}>
        <div
          id="day-grid"
          tabIndex={-1}
          aria-label={`Schedule for ${practitioner}, ${formatDay(currentDay)}`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', outline: 'none', padding: 12, gap: 12 }}
        >
          {/* Date nav — sits on gray, no white bg */}
          <div style={{ background: 'transparent', padding: '0', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              aria-label={`Previous day ${formatDayShort(addDays(BASE_DATE, dayOffset - 1))}`}
              onClick={() => { setDayOffset(d => d - 1); setTimeout(() => dateHeaderRef.current?.focus(), 50) }}
              style={{ width: 32, height: 32, border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >‹</button>
            <button
              aria-label="Go to today"
              onClick={() => setDayOffset(0)}
              style={{ padding: '5px 12px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
            >Today</button>
            <button
              aria-label={`Next day ${formatDayShort(addDays(BASE_DATE, dayOffset + 1))}`}
              onClick={() => { setDayOffset(d => d + 1); setTimeout(() => dateHeaderRef.current?.focus(), 50) }}
              style={{ width: 32, height: 32, border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >›</button>
            <div aria-hidden="true" style={{ flex: 1, fontSize: 18, fontWeight: 700, color: '#222', marginLeft: 8 }}>
              {formatDay(currentDay)}
            </div>
            <div style={{ position: 'relative' }}>
              <button
                aria-label="Go to a specific date"
                aria-expanded={showDatePicker}
                aria-haspopup="dialog"
                onClick={() => { setPickerYear(''); setPickerMonth(''); setPickerDay(''); setPickerAnnouncement(''); setShowDatePicker(v => !v) }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="1" y="3" width="14" height="12" rx="2" stroke="#555" strokeWidth="1.4" fill="none"/>
                  <path d="M1 7h14" stroke="#555" strokeWidth="1.4"/>
                  <path d="M5 1v3M11 1v3" stroke="#555" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Go to date
              </button>
              {showDatePicker && (
                <div
                  role="dialog"
                  aria-label="Go to a specific date"
                  aria-modal="true"
                  style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 300, background: '#fff', border: '1px solid #ddd', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: 20, width: 270 }}
                >
                  <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#333' }}>Go to date</h3>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <div style={{ flex: 2 }}>
                      <label htmlFor="picker-year" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Year</label>
                      <input id="picker-year" autoFocus type="text" inputMode="numeric" placeholder="2026" value={pickerYear}
                        onChange={e => setPickerYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        onKeyDown={e => { if (e.key === 'Escape') setShowDatePicker(false); if (e.key === 'Enter') navigateToDate() }}
                        style={{ width: '100%', padding: '7px 8px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label htmlFor="picker-month" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Month</label>
                      <input id="picker-month" type="text" inputMode="numeric" placeholder="07" value={pickerMonth}
                        onChange={e => setPickerMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        onKeyDown={e => { if (e.key === 'Escape') setShowDatePicker(false); if (e.key === 'Enter') navigateToDate() }}
                        style={{ width: '100%', padding: '7px 8px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label htmlFor="picker-day" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Day</label>
                      <input id="picker-day" type="text" inputMode="numeric" placeholder="13" value={pickerDay}
                        onChange={e => setPickerDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        onKeyDown={e => { if (e.key === 'Escape') setShowDatePicker(false); if (e.key === 'Enter') navigateToDate() }}
                        style={{ width: '100%', padding: '7px 8px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                    </div>
                  </div>
                  <button
                    onClick={navigateToDate}
                    disabled={!pickerYear || !pickerMonth || !pickerDay}
                    style={{ width: '100%', padding: '9px', background: TEAL, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: (!pickerYear || !pickerMonth || !pickerDay) ? 0.4 : 1 }}
                  >Go</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', background: '#fff', border: '1px solid #dde0e4', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ background: '#fff' }}>

              {/* Date header */}
              <div
                ref={dateHeaderRef}
                tabIndex={0}
                data-date-header
                aria-label={`${isToday ? 'Today' : formatDayShort(currentDay)}, ${currentDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
                style={{ padding: '10px 14px', borderBottom: '1px solid #e8e8e8' }}
              >
                <span style={{ fontWeight: 700, fontSize: 13, color: '#E8A33D' }}>
                  {isToday ? 'Today' : formatDayShort(currentDay)}, {currentDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>

              {/* Practitioner header */}
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', borderBottom: '1px solid #e2e2e2' }}>
                <div />
                <div
                  tabIndex={0}
                  aria-label={`Viewing schedule for ${practitioner}`}
                  style={{ borderLeft: '1px solid #e2e2e2', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', outline: 'none' }}
                  onFocus={e => { e.currentTarget.style.outline = `2px solid ${TEAL}`; e.currentTarget.style.outlineOffset = '-2px' }}
                  onBlur={e => { e.currentTarget.style.outline = 'none' }}
                >
                  <div aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', background: TEAL, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>SL</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: TEAL }}>{practitioner}</span>
                </div>
              </div>

              {/* Grid */}
              <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '60px 1fr' }}>

                {/* Time labels */}
                <div aria-hidden="true">
                  {HOURS.map(h => (
                    <div key={h} style={{ height: ROW_HEIGHT, borderBottom: '1px solid #f0f0f0', padding: '4px 6px', boxSizing: 'border-box' }}>
                      <span style={{ color: '#888', fontSize: 11 }}>{formatHour(h)}</span>
                    </div>
                  ))}
                </div>

                {/* Schedule column */}
                <div style={{ position: 'relative', borderLeft: '1px solid #e2e2e2' }}>
                  <div aria-hidden="true">
                    {HOURS.map(h => (
                      <div key={h} style={{ height: ROW_HEIGHT, borderBottom: '1px solid #f0f0f0' }} />
                    ))}
                  </div>

                  {/* Shift indicator */}
                  <div aria-hidden="true" style={{ position: 'absolute', top: (SHIFT_START - HOUR_START) * ROW_HEIGHT, height: (SHIFT_END - SHIFT_START) * ROW_HEIGHT, left: 0, right: 0, background: '#D5E3E4', borderTop: '2px solid #b8cfd1', borderBottom: '2px solid #b8cfd1', pointerEvents: 'none', zIndex: 0 }} />

                  {/* Visual focus highlight */}
                  {focusedRange && (
                    <div aria-hidden="true" style={{ position: 'absolute', top: (focusedRange.startHour - HOUR_START) * ROW_HEIGHT, height: (focusedRange.endHour - focusedRange.startHour) * ROW_HEIGHT - 1, left: 0, right: 0, background: 'transparent', outline: `2px solid ${TEAL}`, outlineOffset: -2, borderRadius: 2, pointerEvents: 'none', zIndex: 2 }} />
                  )}

                  {/* Reserved block — grey, shown while booking panel is open */}
                  {bookingHour !== null && bookingAvailableUntil !== null && (
                    <div aria-hidden="true" style={{ position: 'absolute', top: (bookingHour - HOUR_START) * ROW_HEIGHT, height: (bookingAvailableUntil - bookingHour) * ROW_HEIGHT - 2, left: 2, right: 2, background: '#B8BFC0', color: '#000', borderRadius: 3, padding: '6px 8px', fontSize: 11, lineHeight: 1.4, overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 13, color: '#000' }}>✓</span>
                        <span style={{ fontWeight: 600, color: '#000' }}>{formatHour(bookingHour)} –</span>
                      </div>
                      <div style={{ marginTop: 3, background: 'rgba(0,0,0,0.12)', borderRadius: 3, padding: '1px 6px', display: 'inline-block', fontSize: 10, fontWeight: 600, color: '#000' }}>Reserved</div>
                    </div>
                  )}

                  {/* Visual booked blocks */}
                  {Object.entries(booked).map(([slot, appt]) => {
                    const s = slotToHour(slot)
                    const dur = durationHours(appt.treatment)
                    const isArrived = arrivedSlots.has(slot)
                    const bg = isArrived ? '#8CC27F' : (apptColors[colorMap[slot] ?? 0])
                    const fg = '#000'
                    return (
                      <div key={slot} aria-hidden="true" style={{ position: 'absolute', top: (s - HOUR_START) * ROW_HEIGHT, height: dur * ROW_HEIGHT - 2, left: 2, right: 2, background: bg, color: fg, borderRadius: 3, padding: '5px 8px', fontSize: 11, lineHeight: 1.4, overflow: 'hidden', pointerEvents: 'none', zIndex: 1, textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                          {isArrived && <span style={{ fontSize: 12, marginTop: 1, flexShrink: 0 }}>✓</span>}
                          <div>
                            <div style={{ fontWeight: 700 }}>{formatHour(s)} – {formatHour(s + dur)}</div>
                            <div style={{ fontWeight: 600 }}>{appt.patient}</div>
                            <div>{appt.treatment}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Accessible overlay buttons */}
                  {gridItems.map((item) => {
                    if (item.kind === 'booked') {
                      return (
                        <div
                          key={`booked-${item.startHour}`}
                          tabIndex={0}
                          role="group"
                          aria-roledescription={"\u200B"}
                          aria-label={`Appointment: ${formatHour(item.startHour)} to ${formatHour(item.endHour)}, ${item.patient}, ${item.treatment}`}
                          style={{ position: 'absolute', top: (item.startHour - HOUR_START) * ROW_HEIGHT, height: (item.endHour - item.startHour) * ROW_HEIGHT, left: 0, right: 0, opacity: 0, zIndex: 3 }}
                          onFocus={() => setFocusedRange({ startHour: item.startHour, endHour: item.endHour })}
                          onBlur={() => setFocusedRange(null)}
                        />
                      )
                    }

                    const segments: { startHour: number; endHour: number; inShift: boolean }[] = []
                    const s = item.startHour, e = item.endHour
                    if (s < SHIFT_START) segments.push({ startHour: s, endHour: Math.min(e, SHIFT_START), inShift: false })
                    if (s < SHIFT_END && e > SHIFT_START) segments.push({ startHour: Math.max(s, SHIFT_START), endHour: Math.min(e, SHIFT_END), inShift: true })
                    if (e > SHIFT_END) segments.push({ startHour: Math.max(s, SHIFT_END), endHour: e, inShift: false })

                    return segments.map((seg, si) => {
                      const label = seg.inShift
                        ? `${formatHour(seg.startHour)} to ${formatHour(seg.endHour)}, available. Press Enter to book.`
                        : `${formatHour(seg.startHour)} to ${formatHour(seg.endHour)}, available but outside shift hours. Press Enter to book anyway.`
                      return (
                        <button
                          key={`avail-${item.startHour}-${si}`}
                          aria-label={label}
                          aria-roledescription={"\u200B"}
                          style={{ position: 'absolute', top: (seg.startHour - HOUR_START) * ROW_HEIGHT, height: (seg.endHour - seg.startHour) * ROW_HEIGHT - 1, left: 2, right: 2, background: 'transparent', border: 'none', zIndex: 3, cursor: 'pointer', padding: 0, borderRadius: 2 }}
                          onClick={() => {
                            activeSlotRef.current = document.activeElement as HTMLButtonElement
                            handleSlotClick(seg.startHour, seg.endHour)
                          }}
                          onFocus={() => setFocusedRange({ startHour: seg.startHour, endHour: seg.endHour })}
                          onBlur={() => setFocusedRange(null)}
                        />
                      )
                    })
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {confirmedAppt && (
          <ConfirmedPanel
            patient={confirmedAppt.patient}
            treatment={confirmedAppt.treatment}
            startHour={confirmedAppt.startHour}
            endHour={confirmedAppt.endHour}
            practitioner={practitioner}
            date={currentDay}
            onClose={() => setConfirmedAppt(null)}
            onArrive={() => {
              const slot = `${String(Math.floor(confirmedAppt.startHour)).padStart(2,'0')}:${String(Math.round((confirmedAppt.startHour % 1)*60)).padStart(2,'0')}`
              setArrivedSlots(prev => new Set([...prev, slot]))
            }}
          />
        )}

        {bookingHour !== null && (
          <div style={{ padding: 12, background: '#f0f1f2', overflowY: 'auto', flexShrink: 0 }}>
            <BookingPanel
              practitioner={practitioner}
              startHour={bookingHour}
              availableUntil={bookingAvailableUntil ?? HOUR_END}
              date={currentDay}
              bookedRanges={bookedRanges}
              onClose={() => { setBookingHour(null); setTimeout(() => dateHeaderRef.current?.focus(), 100) }}
              onBook={handleBook}
              onOverlapClose={() => { setBookingHour(null); setTimeout(() => dateHeaderRef.current?.focus(), 100) }}
              onOverlap={() => {
                setBookingHour(null)
                setOverlapAnnouncement('Appointment is not booked as overlapping appointments are disabled.')
                setTimeout(() => dateHeaderRef.current?.focus(), 100)
              }}
              triggerRef={activeSlotRef}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
 *  App root
 * ───────────────────────────────────────────────────────────────── */

export default function App() {
  return (
    <BurritoProvider>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh', overflow: 'hidden' }}>
        <JaneNavBar activeNav="Day" navItems={NAV_ITEMS} />
        <DayView />
      </div>
    </BurritoProvider>
  )
}
