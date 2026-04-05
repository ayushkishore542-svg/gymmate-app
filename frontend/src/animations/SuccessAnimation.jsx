import React from 'react';
import { motion } from 'framer-motion';
import './SuccessAnimation.css';

const SuccessAnimation = ({ message, onComplete }) => {
  return (
    <motion.div
      className="success-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={() => {
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 2000);
      }}
    >
      <motion.div
        className="success-content"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20
        }}
      >
        {/* Checkmark Circle */}
        <motion.div
          className="checkmark-circle"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <motion.svg
            className="checkmark"
            viewBox="0 0 52 52"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <motion.path
              fill="none"
              stroke="#4CAF50"
              strokeWidth="4"
              d="M14 27l7.5 7.5L38 18"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </motion.div>

        {/* Success Message */}
        <motion.h2
          className="success-message"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          {message || 'Success!'}
        </motion.h2>

        {/* Confetti Effect */}
        <div className="confetti-container">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="confetti"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: `hsl(${Math.random() * 360}, 70%, 60%)`,
                animationDelay: `${Math.random() * 0.5}s`
              }}
              initial={{ y: -20, opacity: 1 }}
              animate={{ 
                y: window.innerHeight,
                opacity: 0,
                rotate: Math.random() * 360
              }}
              transition={{
                duration: 2,
                delay: 0.5 + Math.random() * 0.5,
                ease: "easeIn"
              }}
            />
          ))}
        </div>

        {/* Ripple Effect */}
        <motion.div
          className="ripple"
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </motion.div>
    </motion.div>
  );
};

export default SuccessAnimation;
