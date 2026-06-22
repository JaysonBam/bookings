/**
 * Purpose: Module logic for pages\bookings\context\NowContext.tsx.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import timeLib from "../../../lib/time";

interface NowContextType {
    currentTime: Date;
}

const NowContext = createContext<NowContextType>({ currentTime: new Date() });

export const NowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    useEffect(() => {
        const tick = async () => {
            const time = await timeLib.getTime();
            setCurrentTime(time);
        };
        tick(); // initial
        const interval = setInterval(tick, 1000 * 60); // Every minute
        return () => clearInterval(interval);
    }, []);

    return (
        <NowContext.Provider value={{ currentTime }}>
            {children}
        </NowContext.Provider>
    );
};

export const useNow = () => useContext(NowContext);
