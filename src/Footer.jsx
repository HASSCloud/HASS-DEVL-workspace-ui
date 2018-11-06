import React from 'react';
import { Container, Row, Col } from 'reactstrap';

export default class Footer extends React.Component {
  render() {
    const footerMain = (
      <footer id="footer">
        <Container>
          <Row>
            <Col md="12" />
          </Row>
        </Container>
      </footer>
    );

    return footerMain;
  }
}
