'use client';

import React, { useState } from 'react';
import Button from '@/components/Button';
import { MessageCircle, ChevronDown, ChevronUp, Mail, Phone } from 'lucide-react';

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<{text: string, sender: 'user' | 'bot'}[]>([
    { text: 'Hi! How can I help you today?', sender: 'bot' }
  ]);
  const [inputMessage, setInputMessage] = useState('');

  const faqs = [
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept Credit/Debit Cards, UPI, Digital Wallets, Net Banking, and Cash on Delivery. We also offer No Cost EMI options on select cards.',
    },
    {
      question: 'How does the EMI approval process work?',
      answer: 'After selecting EMI as your payment method, you will need to provide your card details, monthly income, and optionally a bank statement. The approval typically takes 5-8 seconds.',
    },
    {
      question: 'What is your return policy?',
      answer: 'We offer a 10-day replacement policy. If you are not satisfied with your purchase, you can replace it within 10 days of delivery.',
    },
    {
      question: 'How long does delivery take?',
      answer: 'Standard delivery takes 3-5 business days. Express delivery (1-2 days) is also available for an additional charge.',
    },
    {
      question: 'Do you ship internationally?',
      answer: 'Currently, we only ship within India. International shipping is not available at this time.',
    },
  ];

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    setChatMessages([...chatMessages, { text: inputMessage, sender: 'user' }]);
    
    setTimeout(() => {
      const botResponse = 'Thanks for your message! Our support team will get back to you shortly. For immediate assistance, please call our helpline.';
      setChatMessages(prev => [...prev, { text: botResponse, sender: 'bot' }]);
    }, 1000);
    
    setInputMessage('');
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-black uppercase mb-8 text-center">Customer Support</h1>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          <div className="bg-white border-4 border-black shadow-brutal">
            <div className="p-6 bg-accent border-b-4 border-black">
              <h2 className="text-2xl font-black uppercase">Frequently Asked Questions</h2>
            </div>
            <div className="p-6">
              {faqs.map((faq, index) => (
                <div key={index} className="mb-4">
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full flex justify-between items-center p-4 border-3 border-black hover:bg-accent transition-colors font-bold text-left"
                  >
                    <span>{faq.question}</span>
                    {openFaq === index ? <ChevronUp /> : <ChevronDown />}
                  </button>
                  {openFaq === index && (
                    <div className="p-4 border-x-3 border-b-3 border-black bg-gray-50">
                      <p className="font-semibold">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border-4 border-black shadow-brutal">
            <div className="p-6 bg-secondary border-b-4 border-black flex items-center gap-3">
              <MessageCircle className="w-6 h-6 text-white" />
              <h2 className="text-2xl font-black uppercase text-white">Live Chat</h2>
            </div>
            <div className="h-96 overflow-y-auto p-6 space-y-4">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 border-3 border-black ${msg.sender === 'user' ? 'bg-primary text-white' : 'bg-white'}`}>
                    <p className="font-semibold">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t-4 border-black">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 border-3 border-black font-semibold focus:outline-none focus:shadow-brutal"
                />
                <Button onClick={handleSendMessage}>Send</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border-4 border-black shadow-brutal p-8 text-center">
            <Mail className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h3 className="text-2xl font-black uppercase mb-2">Email Support</h3>
            <p className="font-semibold text-gray-700 mb-4">Get help via email</p>
            <a href="mailto:support@premium.com" className="font-bold text-primary text-xl">
              support@premium.com
            </a>
          </div>

          <div className="bg-white border-4 border-black shadow-brutal p-8 text-center">
            <Phone className="w-16 h-16 mx-auto mb-4 text-secondary" />
            <h3 className="text-2xl font-black uppercase mb-2">Phone Support</h3>
            <p className="font-semibold text-gray-700 mb-4">Call us 24/7</p>
            <a href="tel:18001234567" className="font-bold text-secondary text-xl">
              1800-123-4567
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
