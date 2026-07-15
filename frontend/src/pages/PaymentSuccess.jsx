import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api.js';

export default function PaymentSuccess() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('verifying'); // 'verifying' | 'error'
    const [errorDetail, setErrorDetail] = useState('');
    const hasRun = useRef(false); // guard against double-invoke in StrictMode

    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;

        const gateway = searchParams.get('gateway');
        const courseId = searchParams.get('course_id');

        const body = { gateway, course_id: courseId };
        if (gateway === 'stripe') {
            body.session_id = searchParams.get('session_id');
        } else if (gateway === 'paypal') {
            body.order_id = searchParams.get('token');
        }

        if (!gateway || !courseId || (gateway === 'stripe' && !body.session_id) ||
            (gateway === 'paypal' && !body.order_id)) {
            setStatus('error');
            setErrorDetail('Missing payment details in the redirect URL.');
            return;
        }

        api.post('/api/payments/checkout/verify/', body)
            .then((res) => {
                if (res.data.verified) {
                    navigate(`/courses/${courseId}`, { replace: true, state: { fromCheckout: true } });
                    setTimeout(() => {
                        navigate(`/courses/${courseId}/learn`, { state: { fromCheckout: true } });
                    }, 50);
                } else {
                    setStatus('error');
                    setErrorDetail(res.data.detail || 'Payment could not be verified.');
                }
            })
            .catch((err) => {
                setStatus('error');
                setErrorDetail(
                    err.response?.data?.detail || 'Something went wrong while verifying your payment.'
                );
            });
    }, [searchParams, navigate]);

    if (status === 'error') {
        return (
            <div className="payment-status payment-status--error">
                <h2>We couldn't confirm your payment</h2>
                <p>{errorDetail}</p>
                <p>
                    If you were charged, contact support with your course name and the
                    time of purchase — no need to try paying again.
                </p>
            </div>
        );
    }

    return (
        <div className="payment-status payment-status--loading">
            <h2>Confirming your payment…</h2>
            <p>Hang tight, this only takes a moment.</p>
        </div>
    );
}