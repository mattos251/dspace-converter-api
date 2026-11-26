#!/usr/bin/env python3
"""
Base compartilhada pelos conversores XML

Reúne o que os conversores têm em comum: log, leitura de XML e indentação da saída.
"""

import xml.etree.ElementTree as ET
from pathlib import Path


class BaseConverter:
    """Funcionalidades comuns aos conversores de input-forms.xml"""

    INDENT = "    "

    def __init__(self, verbose: bool = False):
        self.verbose = verbose

    def log(self, message: str, level: str = "INFO") -> None:
        """Log mensagens de conversão"""
        if self.verbose:
            print(f"[{level}] {message}")

    def parse_xml_file(self, path: Path) -> ET.Element:
        """Parse arquivo XML"""
        try:
            tree = ET.parse(path)
            return tree.getroot()
        except ET.ParseError as e:
            raise ValueError(f"Erro ao parsear XML: {e}")

    def _indent_xml(self, elem: ET.Element, level: int = 0) -> None:
        """Indenta elemento XML recursivamente"""
        indent = "\n" + level * self.INDENT

        if len(elem):
            if not elem.text or not elem.text.strip():
                elem.text = indent + self.INDENT
            if not elem.tail or not elem.tail.strip():
                elem.tail = indent

            for i, child in enumerate(elem):
                self._indent_xml(child, level + 1)
                if not child.tail or not child.tail.strip():
                    if i == len(elem) - 1:
                        child.tail = indent
                    else:
                        child.tail = indent + self.INDENT
        else:
            if level and (not elem.tail or not elem.tail.strip()):
                elem.tail = indent
