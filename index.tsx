import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Chat } from '@google/genai';

// Fix: Add a global declaration for `window.html2canvas` to resolve TypeScript errors at lines 451 and 466.
declare global {
  interface Window {
    html2canvas: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;
  }
}

// --- Main App Component ---
const App = () => {
  const [activePage, setActivePage] = useState('chat');

  const renderPage = () => {
    switch (activePage) {
      case 'chat':
        return <ChatPage />;
      case 'books':
        return <BooksPage />;
      case 'summarizer':
        return <SummarizerPage />;
      case 'quiz':
        return <QuizBuilderPage />;
      case 'updates':
        return <UpdatesPage />;
      default:
        return <ChatPage />;
    }
  };

  return (
    <div className="app-container">
      <main className="content-container">
        {renderPage()}
      </main>
      <BottomNav activePage={activePage} setActivePage={setActivePage} />
    </div>
  );
};

// --- Bottom Navigation Component ---
const BottomNav = ({ activePage, setActivePage }) => {
  const navItems = [
    { id: 'chat', icon: 'chat', label: 'الدردشة' },
    { id: 'books', icon: 'menu_book', label: 'الكتب' },
    { id: 'summarizer', icon: 'mediation', label: 'تلخيص' },
    { id: 'quiz', icon: 'quiz', label: 'أسئلة' },
    { id: 'updates', icon: 'campaign', label: 'التحديثات' },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`nav-button ${activePage === item.id ? 'active' : ''}`}
          onClick={() => setActivePage(item.id)}
          aria-label={item.label}
        >
          <span className="material-icons">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};


// --- API Setup ---
let ai;
try {
    ai = new GoogleGenAI({ apiKey: "AIzaSyBRfDUSaRSjrJ2HQokh4w8TkCK3JrVf4Po" });
} catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
}

// --- Helper Functions ---
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
        } else {
            reject(new Error('Failed to read file as a data URL string.'));
        }
    };
    reader.onerror = error => reject(error);
});


// --- Chat Page Component ---
const ChatPage = () => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (ai) {
            const newChat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: 'You are a helpful assistant for a student. Your responses should be encouraging and clear. Respond in Arabic.',
                },
            });
            setChat(newChat);
        }

        const timer = setTimeout(() => {
            setShowWelcomeModal(true);
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            e.target.value = null; // Allow selecting the same file again
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const handleSendMessage = async () => {
        if ((!inputValue.trim() && !imageFile) || !chat || isLoading) return;

        const userMessage: { role: string; text: string; image: string | null; } = { role: 'user', text: inputValue, image: imagePreview };
        setMessages(prev => [...prev, userMessage]);

        const currentInputValue = inputValue;
        const currentImageFile = imageFile;

        setInputValue('');
        setImageFile(null);
        setImagePreview(null);
        setIsLoading(true);

        try {
            const messageParts: any[] = [];
            if (currentInputValue.trim()) {
                messageParts.push({ text: currentInputValue.trim() });
            }
            if (currentImageFile) {
                const base64Data = await fileToBase64(currentImageFile);
                messageParts.push({
                    inlineData: {
                        mimeType: currentImageFile.type,
                        data: base64Data,
                    },
                });
            }
            
            const response = await chat.sendMessage({ message: messageParts });
            const aiMessage = { role: 'model', text: response.text };
            setMessages(prev => [...prev, aiMessage]);

        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage = { role: 'model', text: 'عذراً، حدث خطأ ما. الرجاء المحاولة مرة أخرى.' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseModal = () => {
        setShowWelcomeModal(false);
    };
    
    if(!ai) {
        return <div className="page"><div className="header"><h1>الدردشة</h1></div><div className="error-message">لم يتم تهيئة واجهة برمجة التطبيقات. يرجى التحقق من مفتاح API الخاص بك.</div></div>;
    }

    return (
        <div className="page chat-page">
            {showWelcomeModal && (
                <div className="welcome-toast">
                    <div className="toast-content">
                        <h4>ملاحظة هامة</h4>
                        <p>سيتم تدريب هذا النموذج قريبًا على المنهج الدراسي السوري الحديث لتقديم إجابات أكثر دقة وتخصصًا.</p>
                    </div>
                    <button onClick={handleCloseModal} className="toast-close-btn" aria-label="إغلاق">&times;</button>
                </div>
            )}
            <div className="chat-history">
                {messages.map((msg, index) => (
                    <div key={index} className={`message-bubble ${msg.role}`}>
                        {msg.image && <img src={msg.image} alt="ملحق المستخدم" className="chat-image" />}
                        {msg.text && <p className="message-text">{msg.text}</p>}
                    </div>
                ))}
                 {isLoading && (
                    <div className="message-bubble model">
                        <div className="loading-dots">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-container">
                 {imagePreview && (
                    <div className="image-preview-container">
                        <img src={imagePreview} alt="معاينة" />
                        <button onClick={handleRemoveImage} className="remove-image-btn" aria-label="إزالة الصورة">
                            <span className="material-icons">close</span>
                        </button>
                    </div>
                )}
                <div className="chat-input-area">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        accept="image/*"
                        style={{ display: 'none' }}
                        aria-hidden="true"
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="attach-btn" 
                        disabled={isLoading} 
                        aria-label="إرفاق صورة"
                    >
                        <span className="material-icons">attachment</span>
                    </button>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="اكتب رسالتك هنا..."
                        aria-label="إدخال الدردشة"
                        disabled={isLoading}
                    />
                    <button 
                        onClick={handleSendMessage} 
                        disabled={isLoading || (!inputValue.trim() && !imageFile)} 
                        aria-label="إرسال رسالة"
                    >
                        <span className="material-icons">send</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Books Page Component ---
const BooksPage = () => {
    const [selectedStage, setSelectedStage] = useState(null);
    const [selectedGrade, setSelectedGrade] = useState(null);

    const stages = [
        {
            name: 'المرحلة الابتدائية',
            icon: 'child_care',
            grades: [
                { name: 'الصف الأول', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'العلوم', icon: 'science' }, { name: 'اللغة العربية', icon: 'abc' } ] },
                { name: 'الصف الثاني', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'العلوم', icon: 'science' }, { name: 'اللغة العربية', icon: 'abc' } ] },
                { name: 'الصف الثالث', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'العلوم', icon: 'science' }, { name: 'اللغة العربية', icon: 'abc' } ] },
                { name: 'الصف الرابع', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'العلوم', icon: 'science' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'الصف الخامس', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'العلوم', icon: 'science' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' }, { name: 'الاجتماعيات', icon: 'public' } ] },
                { name: 'الصف السادس', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'العلوم', icon: 'science' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' }, { name: 'الاجتماعيات', icon: 'public' } ] },
            ]
        },
        {
            name: 'المرحلة الإعدادية',
            icon: 'history_edu',
            grades: [
                { name: 'الصف السابع', subjects: [ { name: 'الجبر', icon: 'calculate' }, { name: 'الهندسة', icon: 'architecture' }, { name: 'العلوم', icon: 'science' }, { name: 'التاريخ', icon: 'history_edu' }, { name: 'الجغرافيا', icon: 'public' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'الصف الثامن', subjects: [ { name: 'الجبر', icon: 'calculate' }, { name: 'الهندسة', icon: 'architecture' }, { name: 'العلوم', icon: 'science' }, { name: 'التاريخ', icon: 'history_edu' }, { name: 'الجغرافيا', icon: 'public' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'الصف التاسع', subjects: [ { name: 'الجبر', icon: 'calculate' }, { name: 'الهندسة', icon: 'architecture' }, { name: 'الفيزياء والكيمياء', icon: 'science' }, { name: 'علم الأحياء', icon: 'biotech' }, { name: 'التاريخ', icon: 'history_edu' }, { name: 'الجغرافيا', icon: 'public' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
            ]
        },
        {
            name: 'المرحلة الثانوية',
            icon: 'school',
            grades: [
                { name: 'العاشر العلمي', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'الفيزياء', icon: 'bolt' }, { name: 'الكيمياء', icon: 'science' }, { name: 'علم الأحياء', icon: 'biotech' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'العاشر الأدبي', subjects: [ { name: 'الفلسفة', icon: 'psychology' }, { name: 'التاريخ', icon: 'history_edu' }, { name: 'الجغرافيا', icon: 'public' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'الحادي عشر العلمي', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'الفيزياء', icon: 'bolt' }, { name: 'الكيمياء', icon: 'science' }, { name: 'علم الأحياء', icon: 'biotech' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'الحادي عشر الأدبي', subjects: [ { name: 'الفلسفة', icon: 'psychology' }, { name: 'التاريخ', icon: 'history_edu' }, { name: 'الجغرافيا', icon: 'public' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'البكالوريا العلمي', subjects: [ { name: 'الرياضيات', icon: 'calculate' }, { name: 'الفيزياء', icon: 'bolt' }, { name: 'الكيمياء', icon: 'science' }, { name: 'العلوم', icon: 'biotech' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
                { name: 'البكالوريا الأدبي', subjects: [ { name: 'الفلسفة', icon: 'psychology' }, { name: 'التاريخ', icon: 'history_edu' }, { name: 'الجغرافيا', icon: 'public' }, { name: 'اللغة العربية', icon: 'abc' }, { name: 'اللغة الإنجليزية', icon: 'translate' } ] },
            ]
        }
    ];
    
    const handleDownload = (subjectName) => {
        alert(`جاري تحميل كتاب ${subjectName} لـ ${selectedGrade.name}... (هذه وظيفة تجريبية)`);
    }

    const handleSelectStage = (stage) => {
        setSelectedStage(stage);
    };
    
    const handleSelectGrade = (grade) => {
        setSelectedGrade(grade);
    };

    const handleGoBack = () => {
        if (selectedGrade) {
            setSelectedGrade(null);
        } else if (selectedStage) {
            setSelectedStage(null);
        }
    };

    const getTitle = () => {
        if (selectedGrade) return `كتب ${selectedGrade.name}`;
        if (selectedStage) return `صفوف ${selectedStage.name}`;
        return 'الكتب المدرسية';
    };

    const renderContent = () => {
        if (!selectedStage) {
            return (
                <div className="stages-list">
                    {stages.map((stage, index) => (
                        <div key={index} className="book-card stage-card" onClick={() => handleSelectStage(stage)}>
                            <span className="material-icons book-icon">{stage.icon}</span>
                            <h3>{stage.name}</h3>
                        </div>
                    ))}
                </div>
            );
        }

        if (!selectedGrade) {
            return (
                <div className="books-list">
                    {selectedStage.grades.map((grade, index) => (
                        <div key={index} className="book-card grade-card" onClick={() => handleSelectGrade(grade)}>
                            <span className="material-icons book-icon">school</span>
                            <h3>{grade.name}</h3>
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div className="books-list">
                {selectedGrade.subjects.map((subject, index) => (
                    <div key={index} className="book-card">
                        <span className="material-icons book-icon">{subject.icon}</span>
                        <h3>{subject.name}</h3>
                        <button onClick={() => handleDownload(subject.name)}>
                            <span className="material-icons">download</span>
                            تحميل
                        </button>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="page">
            <div className="header books-header">
                {selectedStage && (
                    <button onClick={handleGoBack} className="back-button" aria-label="العودة">
                        <span className="material-icons">arrow_forward</span>
                    </button>
                )}
                <h1>{getTitle()}</h1>
            </div>
            {renderContent()}
        </div>
    );
};


// --- Summarizer Page Component ---
const SummarizerPage = () => {
    const [text, setText] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [isMindMapFullscreen, setIsMindMapFullscreen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mindMapRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const isPanningRef = useRef(false);
    const panStartRef = useRef({ x: 0, y: 0 });

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(prevFiles => [...prevFiles, ...Array.from(event.target.files)]);
            event.target.value = null;
        }
    };

    const removeFile = (indexToRemove: number) => {
        setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const startCamera = async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                streamRef.current = stream;
                setIsCameraOpen(true);
            } catch (err) {
                console.error("Error accessing camera: ", err);
                alert("لا يمكن الوصول إلى الكاميرا. يرجى التحقق من الأذونات.");
            }
        }
    };

    useEffect(() => {
        if (isCameraOpen && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [isCameraOpen]);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        setIsCameraOpen(false);
        streamRef.current = null;
    };

    const captureFrame = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob(blob => {
                if(blob) {
                    const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    setFiles(prevFiles => [...prevFiles, file]);
                }
                stopCamera();
            }, 'image/jpeg');
        }
    };

    const handleSummarize = async () => {
        if (files.length === 0 || !ai) return;
        setIsLoading(true);
        setResult(null);

        try {
            const messageParts: any[] = [];
            
            const userInstruction = text.trim() || "Please summarize the content of the attached files and create a hierarchical mind map of the key points.";

            const promptText = `
                You will be given instructions and a set of files (which could be images or PDFs).
                Your task is to follow the instructions.
                If the instructions ask for a summary and a mind map, your entire response MUST be a single JSON object with two keys: "summary" and "mindMap".
                - The value for "summary" should be a string.
                - The value for "mindMap" should be a nested JSON object representing the structure.
                Respond in Arabic.

                Instructions from the user:
                ---
                ${userInstruction}
                ---
            `;
            
            messageParts.push({ text: promptText });

            for (const file of files) {
                if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                    const base64Data = await fileToBase64(file);
                    messageParts.push({
                        inlineData: { mimeType: file.type, data: base64Data },
                    });
                }
            }

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: messageParts },
                config: {
                    responseMimeType: "application/json",
                },
            });

            const jsonStr = response.text.trim();
            const parsedJson = JSON.parse(jsonStr);
            setResult(parsedJson);
        } catch (error) {
            console.error("Error summarizing:", error);
            setResult({ error: 'عذراً، لم أتمكن من معالجة طلبك. قد يكون هناك خطأ في تنسيق الاستجابة من النموذج.' });
        } finally {
            setIsLoading(false);
        }
    };

    const renderMindMap = (data: any): React.ReactNode => {
        if (typeof data !== 'object' || data === null) {
          return <ul><li><span>{String(data)}</span></li></ul>;
        }
        if (Array.isArray(data)) {
          return (
            <ul>
              {data.map((item, index) => {
                if (typeof item === 'object' && item !== null) {
                  return <li key={index}>{renderMindMap(item)}</li>;
                }
                return <li key={index}><span>{String(item)}</span></li>;
              })}
            </ul>
          );
        }
        return (
          <ul>
            {Object.entries(data).map(([key, value]) => (
              <li key={key}>
                <strong>{key.replace(/_/g, ' ')}</strong>
                {renderMindMap(value)}
              </li>
            ))}
          </ul>
        );
    };

    // --- Mind Map Interaction Handlers ---
    const openFullscreen = () => setIsMindMapFullscreen(true);
    const closeFullscreen = () => {
        setIsMindMapFullscreen(false);
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    const handleZoom = (direction: 'in' | 'out') => {
        const zoomFactor = 1.2;
        if (direction === 'in') {
            setZoom(prev => Math.min(prev * zoomFactor, 5));
        } else {
            setZoom(prev => Math.max(prev / zoomFactor, 0.2));
        }
    };

    const handleDownloadMindMap = async () => {
        const element = mindMapRef.current;
        if (!element || typeof window.html2canvas === 'undefined') {
            alert('لا يمكن تحميل الخريطة الذهنية.');
            return;
        }

        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.transform = '';
        clone.style.position = 'absolute';
        clone.style.top = '-9999px';
        clone.style.left = '-9999px';
        clone.style.width = `${element.offsetWidth}px`;
        clone.style.height = `${element.offsetHeight}px`;
        document.body.appendChild(clone);

        try {
            const canvas = await window.html2canvas(clone, {
                useCORS: true,
                scale: 2,
                backgroundColor: '#F7F5F2'
            });
            const image = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            link.download = 'mind-map.png';
            link.href = image;
            link.click();
        } catch (error) {
            console.error('Error downloading mind map:', error);
            alert('حدث خطأ أثناء إنشاء الصورة.');
        } finally {
            document.body.removeChild(clone);
        }
    };

    const getEventCoords = (e: React.MouseEvent | React.TouchEvent) => {
        return 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    };

    const onPanStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        isPanningRef.current = true;
        const coords = getEventCoords(e);
        panStartRef.current = {
            x: coords.x - pan.x,
            y: coords.y - pan.y,
        };
    }, [pan]);

    const onPanMove = useCallback((e) => {
        if (!isPanningRef.current) return;
        e.preventDefault();
        const coords = getEventCoords(e);
        setPan({
            x: coords.x - panStartRef.current.x,
            y: coords.y - panStartRef.current.y,
        });
    }, []);

    const onPanEnd = useCallback(() => {
        isPanningRef.current = false;
    }, []);

    useEffect(() => {
        const viewport = viewportRef.current;
        const moveHandler = (e: MouseEvent | TouchEvent) => onPanMove(e);
        const endHandler = () => onPanEnd();

        if (isMindMapFullscreen && viewport) {
            viewport.addEventListener('mousemove', moveHandler);
            window.addEventListener('mouseup', endHandler);
            viewport.addEventListener('touchmove', moveHandler);
            window.addEventListener('touchend', endHandler);
        }
        return () => {
            if (viewport) {
                viewport.removeEventListener('mousemove', moveHandler);
                viewport.removeEventListener('touchmove', moveHandler);
            }
            window.removeEventListener('mouseup', endHandler);
            window.removeEventListener('touchend', endHandler);
        };
    }, [isMindMapFullscreen, onPanMove, onPanEnd]);


    if (!ai) {
        return <div className="page"><div className="header"><h1>تلخيص</h1></div><div className="error-message">لم يتم تهيئة واجهة برمجة التطبيقات. يرجى التحقق من مفتاح API الخاص بك.</div></div>;
    }

    return (
        <div className="page summarizer-page">
            <div className="summarizer-input-box">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="اكتب توضيحاً لما تريد من الملفات المرفقة (مثال: لخص لي هذا الكتاب)..."
                    rows={4}
                    aria-label="Instructions for summarization"
                ></textarea>

                {files.length > 0 && (
                    <div className="file-preview-area">
                        {files.map((file, index) => (
                            <div key={index} className={`file-preview-item ${file.type === 'application/pdf' ? 'pdf-preview' : ''}`}>
                                {file.type.startsWith('image/') ? (
                                    <img src={URL.createObjectURL(file)} alt={file.name} />
                                ) : (
                                    <>
                                        <span className="material-icons">picture_as_pdf</span>
                                        <span className="file-name">{file.name}</span>
                                    </>
                                )}
                                <button onClick={() => removeFile(index)} aria-label={`إزالة ${file.name}`}>&times;</button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="summarizer-controls">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*,application/pdf"
                        style={{ display: 'none' }}
                        multiple
                        aria-hidden="true"
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="control-btn">
                        <span className="material-icons">attach_file</span> إرفاق ملف
                    </button>
                    <button onClick={startCamera} className="control-btn">
                        <span className="material-icons">photo_camera</span> فتح الكاميرا
                    </button>
                </div>
            </div>

            {isCameraOpen && (
                <div className="camera-modal">
                    <div className="camera-view">
                        <video ref={videoRef} autoPlay playsInline aria-label="Camera feed"></video>
                        <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true"></canvas>
                        <div className="camera-controls">
                            <button onClick={captureFrame} className="capture-btn">التقاط صورة</button>
                            <button onClick={stopCamera} className="close-btn">إغلاق</button>
                        </div>
                    </div>
                </div>
            )}

            <button onClick={handleSummarize} disabled={isLoading || files.length === 0} className="summarize-btn">
                {isLoading ? 'جاري المعالجة...' : 'لخص وأنشئ خريطة'}
            </button>

            {isLoading && <div className="loader"></div>}

            {result && (
                <div className="results-container">
                    {result.error && <p className="error-message">{result.error}</p>}
                    {result.summary && (
                        <div className="result-section">
                            <h2>الملخص</h2>
                            <p>{result.summary}</p>
                        </div>
                    )}
                    {result.mindMap && (
                         <div className="result-section">
                            <div className="result-section-header">
                                <h2>الخريطة الذهنية</h2>
                                <button onClick={openFullscreen} className="control-btn">
                                    <span className="material-icons">fullscreen</span> عرض كامل
                                </button>
                            </div>
                             <div className="mind-map-preview">
                                <div className="mind-map">
                                    {renderMindMap(result.mindMap)}
                                </div>
                             </div>
                         </div>
                    )}
                </div>
            )}

            {isMindMapFullscreen && result?.mindMap && (
                <div className="mind-map-modal">
                    <div className="mind-map-controls">
                        <button onClick={() => handleZoom('in')} aria-label="Zoom In"><span className="material-icons">zoom_in</span></button>
                        <button onClick={() => handleZoom('out')} aria-label="Zoom Out"><span className="material-icons">zoom_out</span></button>
                        <button onClick={handleDownloadMindMap} aria-label="Download"><span className="material-icons">download</span></button>
                        <button onClick={closeFullscreen} aria-label="Close"><span className="material-icons">close</span></button>
                    </div>
                    <div
                        className="mind-map-viewport"
                        ref={viewportRef}
                        onMouseDown={onPanStart}
                        onTouchStart={onPanStart}
                    >
                        <div
                            className="mind-map"
                            ref={mindMapRef}
                            style={{
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            }}
                        >
                            {renderMindMap(result.mindMap)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Quiz Builder Page Component ---
const QuizBuilderPage = () => {
    const [topic, setTopic] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [questionType, setQuestionType] = useState('Multiple Choice');
    const [numQuestions, setNumQuestions] = useState(5);
    const [difficulty, setDifficulty] = useState('Medium');
    const [questions, setQuestions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(prevFiles => [...prevFiles, ...Array.from(event.target.files)]);
            event.target.value = null; // Allow re-selecting the same file
        }
    };

    const removeFile = (indexToRemove: number) => {
        setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const handleGenerateQuestions = async () => {
        if ((!topic.trim() && files.length === 0) || !ai) return;
        setIsLoading(true);
        setQuestions([]);
        setError('');

        try {
            const messageParts: any[] = [];
            
            const userInstruction = topic.trim() || `Generate questions based on the attached files.`;

            const promptText = `
                Based on the following topic/files and constraints, generate a set of exam questions.
                Your entire response MUST be a single JSON object with a single key "questions".
                The value for "questions" should be an array of question objects.

                Each question object must have the following properties:
                - "question": A string containing the question text.
                - "type": A string indicating the question type ("Multiple Choice", "True/False", or "Short Answer").
                - "answer": A string containing the correct answer.
                - "options": An array of strings for "Multiple Choice" questions. This property should only exist for multiple-choice questions. One of the options must be the correct answer.

                Please adhere strictly to this JSON format. Respond in Arabic.

                ---
                Topic/Instructions: "${userInstruction}"
                Question Type: "${questionType}"
                Number of Questions: ${numQuestions}
                Difficulty Level: "${difficulty}"
                ---
            `;
            
            messageParts.push({ text: promptText });

            for (const file of files) {
                if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                    const base64Data = await fileToBase64(file);
                    messageParts.push({
                        inlineData: { mimeType: file.type, data: base64Data },
                    });
                }
            }

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: messageParts },
                config: {
                    responseMimeType: "application/json",
                },
            });
            const jsonStr = response.text.trim();
            const parsedJson = JSON.parse(jsonStr);
            setQuestions(parsedJson.questions || []);

            if (!parsedJson.questions || parsedJson.questions.length === 0) {
                setError('لم يتمكن النموذج من إنشاء أسئلة. حاول مرة أخرى بموضوع مختلف.');
            }
        } catch (err) {
            console.error("Error generating questions:", err);
            setError('عذراً، حدث خطأ أثناء إنشاء الأسئلة. يرجى التحقق من تنسيق استجابة النموذج.');
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!ai) {
        return <div className="page"><div className="header"><h1>أسئلة امتحانية</h1></div><div className="error-message">لم يتم تهيئة واجهة برمجة التطبيقات. يرجى التحقق من مفتاح API الخاص بك.</div></div>;
    }

    return (
        <div className="page quiz-builder-page">
            <div className="header">
                <h1>بناء أسئلة امتحانية</h1>
            </div>

            <div className="quiz-builder-form">
                <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="أدخل النص أو الموضوع لإنشاء أسئلة عنه، أو قم بإرفاق ملف..."
                    rows={6}
                    aria-label="Topic for questions"
                ></textarea>

                {files.length > 0 && (
                    <div className="file-preview-area">
                        {files.map((file, index) => (
                            <div key={index} className={`file-preview-item ${file.type === 'application/pdf' ? 'pdf-preview' : ''}`}>
                                {file.type.startsWith('image/') ? (
                                    <img src={URL.createObjectURL(file)} alt={file.name} />
                                ) : (
                                    <>
                                        <span className="material-icons">picture_as_pdf</span>
                                        <span className="file-name">{file.name}</span>
                                    </>
                                )}
                                <button onClick={() => removeFile(index)} aria-label={`إزالة ${file.name}`}>&times;</button>
                            </div>
                        ))}
                    </div>
                )}
                
                <div className="summarizer-controls">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*,application/pdf"
                        style={{ display: 'none' }}
                        multiple
                        aria-hidden="true"
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="control-btn">
                        <span className="material-icons">attach_file</span> إرفاق ملف أو صورة
                    </button>
                </div>

                <div className="form-controls">
                    <div className="form-group">
                        <label htmlFor="question-type">نوع الأسئلة:</label>
                        <select id="question-type" value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
                            <option value="Multiple Choice">اختيار من متعدد</option>
                            <option value="True/False">صح / خطأ</option>
                            <option value="Short Answer">إجابة قصيرة</option>
                        </select>
                        <p className="form-group-help">اختر شكل الأسئلة التي ترغب في إنشائها.</p>
                    </div>
                    <div className="form-group">
                        <label htmlFor="num-questions">عدد الأسئلة:</label>
                        <input
                            id="num-questions"
                            type="number"
                            value={numQuestions}
                            onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value, 10)))}
                            min="1"
                            max="20"
                        />
                        <p className="form-group-help">حدد عدد الأسئلة المطلوب إنشاؤها (بين 1 و 20).</p>
                    </div>
                    <div className="form-group">
                        <label htmlFor="difficulty">مستوى الصعوبة:</label>
                        <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                            <option value="Easy">سهل</option>
                            <option value="Medium">متوسط</option>
                            <option value="Hard">صعب</option>
                        </select>
                        <p className="form-group-help">اختر مدى صعوبة الأسئلة التي سيتم إنشاؤها.</p>
                    </div>
                </div>

                <button onClick={handleGenerateQuestions} disabled={isLoading || (!topic.trim() && files.length === 0)} className="generate-btn">
                    {isLoading ? 'جاري الإنشاء...' : 'إنشاء الأسئلة'}
                </button>
            </div>
            
            {isLoading && <div className="loader"></div>}
            
            {error && <p className="error-message">{error}</p>}

            {questions.length > 0 && (
                <div className="questions-container">
                    <h2>الأسئلة التي تم إنشاؤها</h2>
                    {questions.map((q, index) => (
                        <div key={index} className="question-card">
                            <p className="question-text"><strong>{index + 1}. </strong>{q.question}</p>
                            {q.type === 'Multiple Choice' && q.options && (
                                <ul className="options-list">
                                    {q.options.map((option, i) => (
                                        <li key={i} className={option === q.answer ? 'correct' : ''}>
                                            {option}
                                        </li>
                                    ))}
                                </ul>
                            )}
                             {q.type !== 'Multiple Choice' && (
                               <p className="answer-text"><strong>الإجابة:</strong> {q.answer}</p>
                             )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Updates Page Component ---
const UpdatesPage = () => {
    const updates = [
        { icon: 'school', title: 'دورات عامة', description: 'دورات شاملة لمختلف المواد الدراسية لتغطية المنهج بالكامل.' },
        { icon: 'note_alt', title: 'نوط وملخصات', description: 'ملخصات مركزة ونوط امتحانية لمساعدتك على المراجعة قبل الاختبارات.' },
        { icon: 'forum', title: 'غرف دردشة خاصة', description: 'غرف نقاش خاصة بكل دورة للتفاعل مع المعلمين والزملاء وطرح الأسئلة.' },
        { icon: 'auto_awesome', title: 'أنظمة ذكية للمساعدة', description: 'أدوات ذكية لتحليل تقدمك الدراسي وتقديم توصيات وخطط مخصصة لك.' }
    ];

    return (
        <div className="page updates-page">
            <div className="header"><h1>التحديثات القادمة</h1></div>
            <p className="updates-intro">نعمل باستمرار على تطوير التطبيق وإضافة ميزات جديدة لمساعدتك في رحلتك الدراسية. إليك لمحة عما هو قادم:</p>
            <div className="updates-list">
                {updates.map((update, index) => (
                    <div key={index} className="update-card">
                        <span className="material-icons update-icon">{update.icon}</span>
                        <h3>{update.title}</h3>
                        <p>{update.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- Render App ---
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);