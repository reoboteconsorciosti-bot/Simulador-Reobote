"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ResultsModalProps {
    isOpen: boolean
    onClose: () => void
    children: React.ReactNode
}

export function ResultsModal({ isOpen, onClose, children }: ResultsModalProps) {
    // Prevent body scroll when modal is open
    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = "unset"
        }
        return () => {
            document.body.style.overflow = "unset"
        }
    }, [isOpen])

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay / Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[99] bg-black/40 backdrop-blur-md"
                        aria-hidden="true"
                    />

                    {/* Modal Container */}
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, y: 40, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 40, scale: 0.95 }}
                            transition={{
                                type: "spring",
                                damping: 25,
                                stiffness: 300,
                                opacity: { duration: 0.2 }
                            }}
                            className="pointer-events-auto w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-xl bg-background/95 shadow-2xl ring-1 ring-border/50 scrollbar-hide relative flex flex-col"
                        >
                            {/* Fixed Close Button Header */}
                            <div className="sticky top-0 right-0 z-50 flex justify-end p-2 bg-gradient-to-b from-background via-background/90 to-transparent">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="rounded-full hover:bg-muted/50 transition-colors"
                                >
                                    <X className="w-5 h-5 text-muted-foreground" />
                                    <span className="sr-only">Fechar</span>
                                </Button>
                            </div>

                            <div className="px-4 pb-8 sm:px-8 sm:pb-10">
                                {children}
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    )
}
